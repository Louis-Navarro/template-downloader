const electron = require('electron');
const DecompressZip = require('decompress-zip');
const url = require('url');
const path = require('path');
const fs = require('fs');

const { dialog, app, Menu, BrowserWindow, ipcMain } = electron;

// SET ENV
// process.env.NODE_ENV = 'production'; // Comment if in development

let mainWindow;
let TARGET_DIR = path.join(__dirname, 'test');

// Listen for app to be ready
app.on('ready', () => {
	// Create new window
	mainWindow = new BrowserWindow({
		webPreferences: {
			nodeIntegration: true
		}
	});
	// Load html file in window
	mainWindow.loadURL(
		url.format({
			pathname: path.join(__dirname, 'mainWindow.html'),
			protocol: 'file:',
			slashes: true
		})
	);
	// Quit app when window is closed
	mainWindow.on('closed', function() {
		app.quit();
	});

	// Create menu
	let mainMenu;
	if (process.env.NODE_ENV !== 'production') {
		const menu = [
			{
				label: 'Developer Tools',
				submenu: [
					{
						label: 'Toogle Dev Tools',
						accelerator: 'CmdOrCtrl+I',
						click(e, focusedWindow) {
							focusedWindow.toggleDevTools();
						}
					},
					{
						role: 'reload'
					}
				]
			}
		];
		mainMenu = Menu.buildFromTemplate(menu);
		mainWindow.webContents.openDevTools();
	} else {
		mainMenu = null;
	}
	// Insert menu
	Menu.setApplicationMenu(mainMenu);

	// Handle download
	mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
		// TODO: Handle error/success
		const TARGET_FILENAME = path.join(TARGET_DIR, 'target.zip');

		item.setSavePath(TARGET_FILENAME);

		item.on('updated', (event, state) => {
			if (state === 'interrupted') {
				console.log('Le téléchargement est interrompu mais peut être redémarrer', event);
			} else if (state === 'progressing') {
				if (item.isPaused()) {
					console.log('Le téléchargement est en pause');
				} else {
					console.log(`Received bytes: ${item.getReceivedBytes()}`);
				}
			}
		});

		item.once('done', (event, state) => {
			if (state === 'completed') {
				console.log('Téléchargement réussi');

				// Unzip downloaded file

				webContents.send('unzipping:start');
				const unzipper = new DecompressZip(TARGET_FILENAME);

				// Define Events
				unzipper.on('error', function(err) {
					console.log('Caught an error', err);
				});
				// Notify when everything is extracted
				unzipper.on('extract', function(log) {
					console.log('Finished extracting', log);

					// Delete .zip file
					fs.unlink(TARGET_FILENAME, (err) => {
						if (err) {
							console.log('An error ocurred while removing the file' + err.message);
							console.log(err);
							return;
						}
						console.log('File successfully removed');
					});
				});
				// Notify "progress" of the decompressed files
				unzipper.on('progress', function(fileIndex, fileCount) {
					webContents.send('unzipping:progress', fileIndex + 1, fileCount);
					console.log('Extracted file ' + (fileIndex + 1) + ' of ' + fileCount);
				});

				// Extract File
				unzipper.extract({
					path: TARGET_DIR
				});
			} else {
				console.log(`Téléchargement échoué : ${state}`);
			}
		});
	});
});

ipcMain.on('select:folder', async () => {
	const infos = await dialog.showOpenDialog({
		properties: [ 'openDirectory' ]
	});
	const path = infos.filePaths[0];
	mainWindow.webContents.send('input:folder', path);
});

ipcMain.on('check:folder', (e, path) => {
	exists = fs.existsSync(path) && fs.lstatSync(path).isDirectory();
	TARGET_DIR = path;
	mainWindow.webContents.send('check:folder', exists);
});

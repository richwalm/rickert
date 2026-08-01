'use strict';

import { HTTPLoader } from './loader_http.js';
import { Layout } from './layout.js';
import { GUI } from './gui.js';

let L, La, G;

function LoadComic(BasePath) {
	GUI.SetMessage('Loading comic...');
	L = new HTTPLoader(BasePath);
	La = new Layout(L);
	G = new GUI(La);
	La.ReadMeta().then(() => {
	}).catch((Err) => {
		console.error('Unable to load comic metadata. Operating in streaming mode.', Err);
	}).finally(() => {
		GUI.SetMessage(false);
		La.SetPage(0);
	});

	globalThis.L = L;
	globalThis.La = La;
	globalThis.G = G;
}

addEventListener('load', (event) => {
	const USP = new URLSearchParams(window.location.search);
	let BasePath = USP.get('name');
	if (BasePath) {
		LoadComic(BasePath);
	} else {
		GUI.SetMessage('No comic specified.');
	}
});

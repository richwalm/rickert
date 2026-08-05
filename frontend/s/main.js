'use strict';

import { HTTPLoader } from './loader_http.js';
import { Layout } from './layout.js';
import { GUI } from './gui.js';

let L, La, G;

function LoadComic(BasePath) {
	GUI.SetMessage('Loading comic...');
	L = new HTTPLoader(BasePath);
	La = new Layout(L);

	La.ReadMeta().then((Meta) => {
		if (!Meta)
			console.warn('Unable to load comic metadata. Operating in streaming mode.');
		GUI.SetMessage(false);
		La.SetPage(0);
		globalThis.G = new GUI(La);
	}).catch((Err) => {
		GUI.SetMessage('Failed to load comic.');
	});

	globalThis.L = L;
	globalThis.La = La;
}

addEventListener('load', (event) => {
	const USP = new URLSearchParams(window.location.search);
	let BasePath = USP.get('name');
	if (BasePath) {
		if (!BasePath.endsWith('/'))
			BasePath += '/';
		LoadComic(BasePath);
	} else
		GUI.SetMessage('No comic specified.');
});

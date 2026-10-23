'use strict';

import { GetExtension } from './common.js';
import { HTTPLoader } from './loader_http.js';
import { ZIPJSLoader } from './loader_zipjs.js';
import { Layout } from './layout.js';
import { GUI } from './gui.js';

let L, La, G;

function LoadComic(Name) {
	GUI.SetMessage('Loading comic...');

	const Extension = GetExtension(Name);
	if (Extension)
		L = new ZIPJSLoader(Name);
	else {
		if (!Name.endsWith('/'))
			Name += '/';
		L = new HTTPLoader(Name);
	}
	globalThis.L = L;
	globalThis.La = La = new Layout(L);

	La.ReadMeta().then((Meta) => {
		if (Meta === false)
			throw new Error('Missing metadata which is required for this comic type.');
		else if (!Meta)
			console.warn('Unable to load comic metadata. Operating in streaming mode.');
		globalThis.G = new GUI(La);
		GUI.SetMessage(false);

		La.SetPage(0);
	}).catch((Err) => {
		console.error('Failed to load comic:', Err);
		GUI.SetMessage('Failed to load comic.');
	});
}

addEventListener('load', (event) => {
	const USP = new URLSearchParams(window.location.search);
	let Name = USP.get('name');
	if (Name) {
		LoadComic(Name);
	} else
		GUI.SetMessage('No comic specified.');
});

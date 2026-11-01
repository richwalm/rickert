'use strict';

import { GetExtension } from './common.js';
import { HTTPLoader } from './loader_http.js';
import { ZIPJSLoader } from './loader_zipjs.js';
import { UNRARITLoader } from './loader_unrarit.js';
import { Layout } from './layout.js';
import { GUI } from './gui.js';

let L, La, G;

function LoadComic(Name) {
	GUI.SetMessage('Loading comic...');

	const Extension = GetExtension(Name).toLowerCase();
	switch (Extension) {
		case 'zip':
		case 'cbz':
			L = new ZIPJSLoader(Name);
			break;
		case 'rar':
		case 'cbr':
			L = new UNRARITLoader(Name);
			break;
		case '':
			if (!Name.endsWith('/'))
				Name += '/';
			L = new HTTPLoader(Name);
			break;
	}

	globalThis.L = L;
	globalThis.La = La = new Layout(L);

	La.ReadMeta().then((Meta) => {
		if (Meta === false)
			throw new Error('Missing metadata which is required for this comic type.');
		else if (!Meta)
			console.warn('Unable to load comic metadata. Operating in streaming mode.');
		La.SetPage(0);
		La.Speed = .5;
		globalThis.G = new GUI(La);
		GUI.SetMessage(false);
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

'use strict';

import { Comic } from './comic.js';
import { GUI } from './gui.js';

let C, G;

function CreateComic(BasePath, Meta) {
	C = new Comic(Meta, BasePath);
	C.SetPage(0);
	globalThis.Comic = C;
	G = new GUI(C);
	globalThis.GUI = G;
}

function LoadComic(BasePath) {
	GUI.SetMessage('Loading comic...');

	const ComicMeta = fetch(BasePath + 'meta.json').then(Response => {
		if (!Response.ok)
			throw new Error(`Response status: ${Response.status}`);
		return Response.json();
	}).then(JSON => {
		CreateComic(BasePath, JSON);
		GUI.SetMessage(false);
	}).catch(Error => {
		console.log(Error);
		GUI.SetMessage('Failed to load comic.');
	});
}

addEventListener('load', (event) => {
	const USP = new URLSearchParams(window.location.search);
	let BasePath = USP.get('name');
	if (BasePath) {
		if (!BasePath.endsWith('/'))
			BasePath += '/';
		LoadComic(BasePath);
	} else {
		GUI.SetMessage('No comic specified.');
	}
});

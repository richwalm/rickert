'use strict';

import { Comic } from './comic.js';

let C;

function SetMessage(Message) {
	const MsgEle = document.getElementById('msg');
	if (!Message) {
		MsgEle.style.display = 'none';
		return;
	}
	MsgEle.textContent = Message;
	MsgEle.style.display = 'flex';
}

function CreateComic(BasePath, Meta) {
	C = new Comic(Meta, BasePath);
	C.SetPage(0);
	globalThis.Comic = C;
}

function LoadComic(BasePath) {
	SetMessage('Loading comic...');

	const ComicMeta = fetch(BasePath + 'meta.json').then(Response => {
		if (!Response.ok)
			throw new Error(`Response status: ${Response.status}`);
		return Response.json();
	}).then(JSON => {
		CreateComic(BasePath, JSON);
		SetMessage(false);
	}).catch(Error => {
		console.log(Error);
		SetMessage('Failed to load comic.');
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
		SetMessage('No comic specified.');
	}
});

'use strict';

import { GetExtension } from './common.js';
import { Loader } from './loader.js';
import { DownloadMeta } from './loader_http.js';
import {
	unrar,
	HTTPRangeReader
} from './dist/unrarit.module.min.js';

const ImageExtensions = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'jxl': 'image/jxl', 'avif': 'image/avif', 'avifs': 'image/avif-sequence', 'webp': 'image/webp'};

export class UNRARITLoader extends Loader {
	constructor(Input) {
		super();
		this._Entries = [];
		this._Input = '';

		if (Input instanceof Blob)
			this._I = Input;
		else if (typeof Input === 'string') {
			this._I = new HTTPRangeReader(Input);
			this._Input = Input;
		} else
			throw new Error('Input isn\'t a valid input type.');
	}

	async LoadMeta() {
		// Return a copy if we already have it.
		if (this._Meta)
			return await this._Meta;

		let MetaEntry = null;

		const ImageCount = await unrar(this._I).then((RAREntries) => {
			const Entries = new Map();
			const ImageFilenames = [];

			for (const Ent of Object.entries(RAREntries.entries)) {
				if (Ent[1].isDirectory) continue;

				const Ext = GetExtension(Ent[0]).toLowerCase();
				if (Ext in ImageExtensions) {
					ImageFilenames.push(Ent[0]);
					Entries.set(Ent[0], Ent[1]);
				}

				if (Ent[0].toLowerCase() == this._MetaFilename)
					MetaEntry = Ent[1];
			}

			if (!ImageFilenames.length)
				throw new Error('No valid image formats within this RAR.')

			ImageFilenames.sort();	// This generally should already be the case, but we'll do it anyway.
			for (const Filename of ImageFilenames)
				this._Entries.push(Entries.get(Filename));

			return ImageFilenames.length;
		}).catch((Err) => {
			console.error('Failed to read RAR contents:', Err);
			return 0;
		});
		if (!ImageCount)
			return false;

		this._MaxDeadImage = this._Entries.length;
		this._SetLayoutEnd(this._Entries.length);

		if (MetaEntry) {
			const JSONObj = await MetaEntry.json();
			if (JSONObj) {
				this._ReadMeta(JSONObj);
				return JSONObj;
			}
		}

		if (this._Input) {
			const Extension = GetExtension(this._Input);
			const Path = this._Input.slice(0, -Extension.length) + 'json';
			const JSONObj = await DownloadMeta(Path);
			if (JSONObj) {
				this._ReadMeta(JSONObj);
				return JSONObj;
			}
		}

		return;
	}

	async LoadImage(Number) {
		const Loaded = this._CommonLoadCheck(Number);
		if (Loaded)
			return await Loaded;

		const Img = new Image();
		this._Loaded.set(Number, Img);
		this._SetPage(Number, {'Img': Img});

		const Ent = this._Entries[Number];
		const MIMEType = ImageExtensions[GetExtension(Ent.name).toLowerCase()];
		const BlobData = await Ent.blob(MIMEType);
		if (!BlobData) {
			console.error('Failed to obtain blob.');
			return;
		}

		Img.src = URL.createObjectURL(BlobData);

		return Img.decode().then(() => {
			const Size = [Img.naturalWidth, Img.naturalHeight];
			this._SetPage(Number, {'Size': Size});
			return Img;
		}).catch((Err) => {
			console.error('Failed to load image', Number, ':', Err);
			throw Err;
		});
	}

	UnloadImage(Number) {
		const Loaded = this._Loaded.get(Number);
		if (!Loaded)	// Could be hit if we're on a very slow connection.
			return;
		if (Loaded.src)
			URL.revokeObjectURL(Loaded.src);
		super.UnloadImage(Number);
	}
}

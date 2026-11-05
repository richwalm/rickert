'use strict';

import { HLCanvas } from './canvas.js';

export class GUI {
	constructor(C) {
		this._C = C;
		this._DefaultSpeed = C.Speed;
		this._InstantMode = false;
		this._PanelMode = false;
		if (this._C.HasViewpoints)
			this.SwitchMode(true);
		addEventListener('keydown', this._HandleKey.bind(this));

		this._Nav = document.getElementById('nav');

		this._IdleTimer = null;
		this._MouseMove();
		document.addEventListener('mousemove', this._MouseMove.bind(this));

		this._Left = document.getElementById('left');
		this._Left.addEventListener('click', this._MovePageKey.bind(this, -1));
		this._Left.addEventListener('wheel', this._OnWheel.bind(this));
		this._Right = document.getElementById('right');
		this._Right.addEventListener('click', this._MovePageKey.bind(this, 1));
		this._Right.addEventListener('wheel', this._OnWheel.bind(this));
	}

	_OnWheel(e) {
		HLCanvas.ScrollBy(e.deltaX, e.deltaY);
	}

	_Idle(e) {
		console.log('Idle reached.');
		document.body.style.cursor = 'none';
		this._Nav.classList.add('idle');
		this._IdleTimer = null;
	}
	_MouseMove(e) {
		if (!this._IdleTimer) {
			// Back from an idle state.
			this._Nav.classList.remove('idle');
			document.body.style.cursor = 'auto';
		} else
			clearTimeout(this._IdleTimer);
		this._IdleTimer = setTimeout(this._Idle.bind(this), 4000);
	}

	AdjustScrollbars(Ver, Hoz) {
		this._Right.style.right = Hoz + 'px';
		this._Left.style.bottom = this._Right.style.bottom = Ver + 'px';
	}

	static SetMessage(Message) {
		const MsgEle = document.getElementById('msg');
		if (!Message) {
			MsgEle.style.display = 'none';
			return;
		}
		MsgEle.firstChild.textContent = Message;
		MsgEle.style.display = 'flex';
	}

	_MovePageKey(Dir) {
		if (!this._C.StandardDirection)	// Flip direction for left to right or down to up comics.
			Dir = -Dir;
		let Return = this._C.Move(Dir);
		if (!Return) {
			// TODO: Pop up with a do you want to go to the next comic message. Otherwise, mention that they're going to wrong way.
		}
		return Return;
	}

	SwitchMode(WantPanelMode) {
		if (WantPanelMode && !this._C.HasViewpoints) {
			// TODO: Pop up with this comic doesn't have viewpoints.
			return;
		}

		this._C.MoveByViewpoint = WantPanelMode;
		this._C.HideNonFocusPages = !WantPanelMode;
		if (WantPanelMode)
			this._C.FillMode = false;

		// TODO: Pop up with switch message.
		this._PanelMode = WantPanelMode;
	}

	_ArrowKeyPress(X, Y, e) {
		// Increase rate if alt keys were held.
		let Pages = 1;
		let ScrollSpeed = 120;
		if (e.shiftKey && e.ctrlKey) {
			Pages = 50;
			ScrollSpeed = 4800;
		} else if (e.ctrlKey) {
			Pages = 10;
			ScrollSpeed = 480;
		} else if (e.shiftKey) {
			Pages = 5;
			ScrollSpeed = 240;
		}

		const SO = HLCanvas.ScrollOffset;
		function CanScroll(Dir, ScrollAreaPos) {
			Dir = (Dir + 1) / 2; // Convert to 0..1, same as ScrollAreaPos.
			return (Dir != ScrollAreaPos);
		}
		if (X) {
			if (SO[0] !== null && CanScroll(X, SO[0])) {
				HLCanvas.ScrollBy(X * ScrollSpeed, 0);
			} else if (this._C.IsHoz)
				return this._MovePageKey(X * Pages);
		}
		if (Y) {
			if (SO[1] !== null && CanScroll(Y, SO[1])) {
				HLCanvas.ScrollBy(0, Y * ScrollSpeed);
			} else if (this._C.IsVer)
				return this._MovePageKey(Y * Pages);
		}
		return true;
	}

	_HandleKey(e) {
		switch (e.code) {
			case 'ArrowLeft':
				this._ArrowKeyPress(-1, 0, e);
				e.preventDefault();
				break;
			case 'ArrowRight':
				this._ArrowKeyPress(1, 0, e);
				e.preventDefault();
				break;
			case 'ArrowUp':
				this._ArrowKeyPress(0, -1, e);
				e.preventDefault();
				break;
			case 'ArrowDown':
				this._ArrowKeyPress(0, 1, e);
				e.preventDefault();
				break;
			case 'Home':
				this._C.SetPage(0);
				e.preventDefault();
				break;
			case 'End':
				this._C.SetPage(this._C.MaxImages - 1);
				e.preventDefault();
				break;
			case 'KeyX':
				this._C.ShowVPs = !this._C.ShowVPs;
				// TODO: Should display a message about this.
				e.preventDefault();
				break;
			case 'KeyP':
				this.SwitchMode(!this._PanelMode);
				e.preventDefault();
				break;
			case 'KeyF':
				this._C.FillMode = !this._C.FillMode;
				e.preventDefault();
				break;
			case 'KeyI':
				this._InstantMode = !this._InstantMode;
				this._C.Speed = this._InstantMode ? 0 : this._DefaultSpeed;
				// TODO: Add message.
				e.preventDefault();
				break;
			case 'KeyD':
				const ExtraPages = this._C.ExtraPages > 0 ? 0 : 1;
				this._C.HideNonFocusPages = true;
				this._PanelMode = false;
				this._C.ExtraPages = ExtraPages;
				e.preventDefault();
				break;
			default:
				return;
		}
	}
}

// Add Quit Menu Entry to Popover
// Copyright (C) 2012 Joern Konopka
// Copyright (C) 2013 Alex Palaistras
// Convenience Functions stolen from windowoverlay-icons@sustmidown.centrum.cz

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

const Lang = imports.lang;
const St = imports.gi.St;
const Atk = imports.gi.Atk;
const Signals = imports.signals;
const Mainloop = imports.mainloop;

const AppDisplay = imports.ui.appDisplay;
const PopupMenu  = imports.ui.popupMenu;
const AppFavorites = imports.ui.appFavorites;

let quitfromDashInjections;

//Custom
const PopupButtonMenuItem = new Lang.Class({
	Name: 'PopupButtonMenuItem',
	Extends: PopupMenu.PopupBaseMenuItem,

	_init: function(text,iconName, params) {
		this.parent(params);

		this.label = new St.Label({text: text});
		this._button = new St.BoxLayout({style_class: 'popup-menu-icons',
			accessible_role: Atk.Role.PUSH_BUTTON,
			hover: true,
			reactive: true,
			can_focus: true});

		this._icon = new St.Icon({style_class: 'popup-menu-icon'});
		this._icon.icon_name = iconName;

		this._button.add_actor(this._icon);

		this.actor.add(this.label);
		this.actor.add(this._button, {expand: true, x_fill: false, x_align: St.Align.END});

		this._button.opacity = 0;
		this._button_active = false;

		//this._button.connect('button-press-event', Lang.bind(this, this._onButtonPress));
		this._button.connect('enter-event', Lang.bind(this, this._onButtonEnter));
		this._button.connect('leave-event', Lang.bind(this, this._onButtonLeave));
		this.actor.connect('enter-event', Lang.bind(this, this._onItemEnter));
		this.actor.connect('leave-event', Lang.bind(this, this._onItemLeave));
	},

	_onButtonEnter: function(actor,event) {
		this._button_active = true;
	},

	_onButtonLeave: function(actor,event) {
		this._button_active = false;
	},

	_onItemEnter: function(actor,event) {
		if (this._button_active === true) {
			this._button.opacity = 255;
		} else {
			this._button.opacity = 128;
		}
	},

	_onItemLeave: function(actor,event){
		this._button.opacity = 0;
	}
});

// Convenience Functions
function injectToFunction(parent, name, func) {
	let origin = parent[name];
	parent[name] = function() {
		let ret;
		ret = origin.apply(this, arguments);
		if (ret === undefined) {
			ret = func.apply(this, arguments);
		}

		return ret;
	};

	return origin;
}

function removeInjection(object, injection, name) {
	if (injection[name] === undefined) {
		delete object[name];
	} else {
		object[name] = injection[name];
	}
}

function resetState() {
	quitfromDashInjections = { };
}

function closeWindowInstance(metaWindow) {
	metaWindow.delete(global.get_current_time());
}

function enable() {
	resetState();

	quitfromDashInjections['_redisplay'] = undefined;
	quitfromDashInjections['_onActivate'] = undefined;

	quitfromDashInjections['_redisplay'] = injectToFunction(AppDisplay.AppIconMenu.prototype, '_redisplay', function() {
		this.removeAll();

		let appWindows = this._source.app.get_windows();

		// Display the app windows menu items and the separator between windows
		// of the current desktop and other windows.
		let activeWorkspace = global.screen.get_active_workspace();
		let separatorShown = appWindows.length > 0 && appWindows[0].get_workspace() != activeWorkspace;

		for (let i = 0; i < appWindows.length; i++) {
			if (!separatorShown && appWindows[i].get_workspace() != activeWorkspace) {
				this._appendSeparator();
				separatorShown = true;
			}

			let menuItem = new PopupButtonMenuItem(appWindows[i].title, "edit-delete-symbolic", {});
			menuItem._windowactor = appWindows[i];
			this.addMenuItem(menuItem);
		}

		if (!this._source.app.is_window_backed()) {
			if (appWindows.length > 0) {
				this._appendSeparator();
			}

			let isFavorite = AppFavorites.getAppFavorites().isFavorite(this._source.app.get_id());

			this._newWindowMenuItem = this._appendMenuItem(_("New Window"));
			this._appendSeparator();

			this._toggleFavoriteMenuItem = this._appendMenuItem(isFavorite ? _("Remove from Favorites") : _("Add to Favorites"));
		}

		let app = this._source.app;
		let count = app.get_n_windows();

		this._quitfromDashMenuItem = undefined;

		if (count == 1) {
			this._appendSeparator();
			this._quitfromDashMenuItem = this._appendMenuItem(_("Quit")); 
		} else if (count > 1) {
			this._appendSeparator();
			this._quitfromDashMenuItem = this._appendMenuItem(_("Quit " + count + " Windows")); 
		}
	});

	quitfromDashInjections['_onActivate'] = injectToFunction(AppDisplay.AppIconMenu.prototype, '_onActivate', function(actor, child) {
		if (child == this._quitfromDashMenuItem) {
			let app = this._source.app;
			let windows = app.get_windows();
		
			for (let i = 0; i < windows.length; i++) {
				closeWindowInstance(windows[i]);
			}
		}
		
		if (child._windowactor) {
			if (child._button_active == true) {
				let metaWindow = child._windowactor;
				closeWindowInstance(metaWindow);
			} else {
				let metaWindow = child._windowactor;
				this.emit('activate-window', metaWindow);
			}
		}
	});
}
	

function disable() {
	for (i in quitfromDashInjections) {
		removeInjection(AppDisplay.AppIconMenu.prototype, quitfromDashInjections, i);
	}

	resetState();
}

function init() {
	/* do nothing */
}

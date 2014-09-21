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

		let windows = this._source.app.get_windows().filter(function(w) {
				return !w.skip_taskbar;
		});

		// Display the app windows menu items and the separator between windows
		// of the current desktop and other windows.
		let activeWorkspace = global.screen.get_active_workspace();
		let separatorShown = windows.length > 0 && windows[0].get_workspace() != activeWorkspace;

		for (let i = 0; i < windows.length; i++) {
				let window = windows[i];
				if (!separatorShown && window.get_workspace() != activeWorkspace) {
						this._appendSeparator();
						separatorShown = true;
				}
				let item = this._appendMenuItem(window.title);
				item.connect('activate', Lang.bind(this, function() {
						this.emit('activate-window', window);
				}));
		}

		if (!this._source.app.is_window_backed()) {
				this._appendSeparator();

				this._newWindowMenuItem = this._appendMenuItem(_("New Window"));
				this._newWindowMenuItem.connect('activate', Lang.bind(this, function() {
						this._source.app.open_new_window(-1);
						this.emit('activate-window', null);
				}));
				this._appendSeparator();

				let appInfo = this._source.app.get_app_info();
				let actions = appInfo.list_actions();
				for (let i = 0; i < actions.length; i++) {
						let action = actions[i];
						let item = this._appendMenuItem(appInfo.get_action_name(action));
						item.connect('activate', Lang.bind(this, function(emitter, event) {
								this._source.app.launch_action(action, event.get_time(), -1);
								this.emit('activate-window', null);
						}));
				}
				this._appendSeparator();

				let isFavorite = AppFavorites.getAppFavorites().isFavorite(this._source.app.get_id());

				if (isFavorite) {
						let item = this._appendMenuItem(_("Remove from Favorites"));
						item.connect('activate', Lang.bind(this, function() {
								let favs = AppFavorites.getAppFavorites();
								favs.removeFavorite(this._source.app.get_id());
						}));
				} else {
						let item = this._appendMenuItem(_("Add to Favorites"));
						item.connect('activate', Lang.bind(this, function() {
								let favs = AppFavorites.getAppFavorites();
								favs.addFavorite(this._source.app.get_id());
						}));
				}
		}

		let app = this._source.app;
		let count = app.get_n_windows();

		this._quitfromDashMenuItem = undefined;

		if ( count > 0) {

			this._appendSeparator();
			let quitFromDashMenuText = "";
			if (count == 1)
				quitFromDashMenuText = _("Quit"); 
			else
				quitFromDashMenuText = _("Quit " + count + " Windows"); 

			this._quitfromDashMenuItem = this._appendMenuItem(quitFromDashMenuText); 
			this._quitfromDashMenuItem.connect('activate', Lang.bind(this, function() {
				let app = this._source.app;
				let windows = app.get_windows();

				for (let i = 0; i < windows.length; i++) {
					closeWindowInstance(windows[i])
				}
			}));

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


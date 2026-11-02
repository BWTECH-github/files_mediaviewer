require('../styles/default.scss')

import app from './setup.js';

// Components

import Viewer from './Viewer.vue';
import Spinner from './ViewerSpinner.vue';

// Libs

import Swiper from 'swiper';

import Vue from 'vue';
import VueRouter from 'vue-router';

Vue.use(VueRouter);

// --- Global Components

import moment from 'moment';
import 'moment-duration-format';

import {
	helper,
	directive
} from './helper.js';


Vue.mixin(helper);
Vue.directive('translate', directive);
Vue.component('spinner', Spinner);

const bus = new Vue();

Vue.prototype.$bus     = bus;
Vue.prototype.$wiper   = Swiper;
Vue.prototype.$app     = app;

import {
	fileFromAddress,
	setAddress
} from './address.js';

const router = new VueRouter({
	// Die Adresse führt die App selbst (address.js). Im Hash-Modus legte der
	// Router Zustände in die Browserchronik, die die Dateien-App bei
	// Zurück/Vorwärts als ihre Parameter las.
	mode: 'abstract',
	routes: [{
		path: '/',
		component: {
			name: 'Hibernate',
			template : '<!-- Sleep warm, sleep tight, when you turn off the light. -->'
		}
	}, {
		path: `/${app.name}/:file`,
		name: 'Viewer',
		component: Viewer
	}]
});

// Blättern und Schließen im Betrachter bekommen einen Eintrag in der Chronik.
// Folgt der Router der Adresse, stimmt sie schon und bleibt, wie sie ist.
router.afterEach((to) => {
	const fileName = to.params.file || null;
	if (fileFromAddress() !== fileName) {
		setAddress(fileName);
	}
});

// Liste und Ordner, aus denen der Betrachter seine Medien hat
let source = { list: null, dir: null };

/**
 * Der Betrachter folgt der Adresse: Öffnen, Blättern und Schließen über
 * Zurück/Vorwärts, eine aufgerufene oder neu geladene Betrachteradresse.
 *
 * @param {OCA.Files.FileList} [fileList] Liste, aus der das Medium kommt
 */
OCA.Mediaviewer.followAddress = (fileList) => {
	const fileName = fileFromAddress();
	const current = router.currentRoute.params.file || null;
	if (fileName && fileList) {
		const dir = fileList.getCurrentDirectory();
		const otherSource = fileList !== source.list || dir !== source.dir;
		// Gleicher Name aus derselben Liste: nichts zu tun, auch nicht, wenn
		// sie im Hintergrund neu geladen hat. Aus einer anderen Liste oder
		// einem anderen Ordner (Zurück/Vorwärts über einen Ordnerwechsel)
		// zeigte der Betrachter sonst das Medium des alten Ordners.
		if (fileName === current && !otherSource) {
			return;
		}
		source = { list: fileList, dir };
		OCA.Mediaviewer.files = fileList.files;
		if (fileName === current) {
			bus.$emit('viewer:rebuild');
			return;
		}
	}
	// Gleicher Stand: keine Navigation auf die eigene Stelle, die vue-router
	// als Fehler meldet ("Avoided redundant navigation to current location")
	else if (fileName === current) {
		return;
	}
	router.replace(fileName ? { name: 'Viewer', params: { file: fileName } } : '/');
};

// ------------------------------------------------------------------- store ---

import Vuex from 'vuex';
Vue.use(Vuex);

import store from './store.js';
const Store = new Vuex.Store(store);

// --------------------------------------------------------------- app setup ---

// Japp … we need to wait for a ready DOM
$(document).ready(() => {
	new Vue({
		el : '#files_mediaviewer > div',
		router,
		store : Store,
		// Render-Funktion statt Laufzeit-Template: so kommt das Vue-Build ohne
		// Template-Compiler aus. Der Slot-Text an <router-view> war wirkungslos,
		// weil Vue Router 3 den Standard-Slot nicht rendert.
		render: h => h('keep-alive', [h('router-view')]),
		data: {
			name: 'Mediaviewer'
		}
	});
});

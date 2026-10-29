<template>
	<div class="wrapper" role="dialog" aria-modal="true" :aria-label="dialogLabel" tabindex="-1" @click.stop="_closeViewer($event)">
		<div class="viewer">
			<div class="viewer__container">
				<div class="viewer__wrapper">
					<div class="viewer__slide" v-for="(slide, index) in list" :key="index" :aria-hidden="index === swiper.activeIndex ? null : 'true'">
						<img v-if="getType(slide) === 'image' && shouldRender(index)" class="viewer__media viewer__media--image" :class="{ 'viewer__media--failed' : isFailed(slide) }" :src="thumbPath(slide)" :alt="slide.name" @error="markFailed(slide)">
						<p v-if="getType(slide) === 'image' && isFailed(slide)" class="viewer__failed" role="alert" v-text="t('Failed to load image data')"></p>
						<video v-if="getType(slide) === 'video' && shouldRender(index)" class="viewer__media viewer__media--video" :controls="isFullscreen" :class="{ 'viewer__media--video-paused' : isPaused }" preload="metadata">
							<source :src="webdavPath(index, slide)" :type="slide.mimetype">
						</video>
						<img v-if="!shouldRender(index)" src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==" alt="" />
					</div>
				</div>
			</div>
			<viewer-controls></viewer-controls>
		</div>
	</div>
</template>
<script>
import ViewerControls from './ViewerControls.vue';

export default {
	name: 'Viewer',
	components : {
		ViewerControls
	},
	data () {
		return {
			swiper : {
				activeIndex : 0
			},
			list : null,
			// Bilder, deren Vorschau der Server nicht liefern konnte (Name -> true)
			failed : {}
		};
	},
	methods: {
		isFailed (item) {
			return this.failed[item.name] === true;
		},
		// Kaputte oder nicht darstellbare Bilder: statt des zerbrochenen
		// Bildsymbols erklärt eine Meldung im Betrachter, was los ist.
		markFailed (item) {
			this.$set(this.failed, item.name, true);
		},
		// Bedienbare Elemente des Betrachters in Tab-Reihenfolge
		focusables () {
			return Array.from(this.$el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), video[controls]'))
				.filter((el) => !el.disabled && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[aria-hidden="true"]'));
		},
		// Modaler Dialog: Tab und Umschalt+Tab bleiben im Betrachter, statt in
		// die verdeckte Dateiliste dahinter zu wandern.
		_trapFocus (e) {
			if (e.key !== 'Tab' || !this.$el || !this.$el.isConnected) {
				return;
			}
			const items = this.focusables();
			if (items.length === 0) {
				e.preventDefault();
				this.$el.focus();
				return;
			}
			const first = items[0];
			const last = items[items.length - 1];
			const active = document.activeElement;
			if (!this.$el.contains(active)) {
				e.preventDefault();
				(e.shiftKey ? last : first).focus();
			}
			else if (e.shiftKey && (active === first || active === this.$el)) {
				e.preventDefault();
				last.focus();
			}
			else if (!e.shiftKey && active === last) {
				e.preventDefault();
				first.focus();
			}
		},
		// Nach dem Schließen zurück zur Zeile der zuletzt gezeigten Datei, damit
		// Tastaturnutzer in der Liste dort weitermachen, wo sie waren.
		_restoreFocus (name) {
			if (!name) {
				return;
			}
			const zeile = Array.from(document.querySelectorAll('#fileList tr[data-file]')).find((tr) => tr.getAttribute('data-file') === name);
			const ziel = zeile ? (zeile.querySelector('a.name') || zeile) : null;
			if (ziel && typeof ziel.focus === 'function') {
				ziel.focus();
			}
		},
		_closeViewer () {
			// Handmade propagation stopper
			if ($(event.target).hasClass('viewer__slide'))
			{this.closeViewer();}
		},
		thumbPath (item) {
			let webdavPath;

			if (this.isPublic) {
				let path   = OC.filePath('files_sharing', 'ajax', 'publicpreview.php');
				let params = OC.buildQueryString({
					file : item.path + '/' + item.name,
					c: item.etag,
					x: this.thumbDimensions,
					y: this.thumbDimensions,
					a: 1,
					t : this.sharingToken
				});

				webdavPath = `${path}?${params}`;
			}

			else {
				let path = OC.joinPaths(
					OC.linkToRemoteBase('dav/files'),
					OC.getCurrentUser().uid,
					item.path,
					item.name
				);

				let params = $.param({
					c: item.etag,
					x: this.thumbDimensions,
					y: this.thumbDimensions,
					a: 1,
					preview: 1
				});

				webdavPath = OC.encodePath(path) + '?' + params
			}

			return webdavPath;
		},

		webdavPath (i, item) {
			let webdavPath;

			if (this.isPublic) {
				let path   = OC.generateUrl(`/s/${this.sharingToken}/download`);
				let params = OC.buildQueryString({
					path: item.path,
					files: item.name
				});

				webdavPath = `${path}?${params}`;
			}

			else {
				let path = OC.joinPaths(
					OC.linkToRemoteBase('webdav'),
					item.path,
					item.name
				);

				webdavPath = OC.encodePath(path);
			}

			return webdavPath;
		},

		getType (item) {
			return item.mimetype.split('/')[0];
		},

		// Returns true if i is equal or adjacent to activeIndex
		shouldRender(i) {
			return (this.swiper) ? _.contains([i - 1,i, i + 1], this.swiper.activeIndex) : false;
		},

		fetchFileList(callback) {

			let fetch = new Promise( (resolve, reject) => {

				let list = _.filter(OCA.Mediaviewer.files, (file) => {
					return _.contains(this.$app.config.mimetypes, file.mimetype);
				});

				if (list.length === 0) {
					reject('list length is 0');
					return;
				}
				this.list = list;
				this.$store.dispatch('setMaxIndex', list.length);
				resolve(list);
			});
			
			fetch.then((list) => {
				if (typeof callback === 'function') {
					callback(list);
				}

				return;
			});
		}
	},

	activated () {
		// Swiper is a bit tricky
		// when it comes to "this" context
		const self = this;

		this.fetchFileList((fileList) => {
			let initialSlide = _.findWhere(fileList, { name : this.$route.params.file });
			initialSlide = _.findIndex(fileList, initialSlide);

			this.swiper = new this.$wiper('#files_mediaviewer .viewer__container', {
				initialSlide,
				resistance   : false,
				slideClass   : 'viewer__slide',
				wrapperClass : 'viewer__wrapper',
				navigation : {
					prevEl : '.viewer__control--prev',
					nextEl : '.viewer__control--next',
				},
				on : {
					init : function () {
						// Sadly, there is no afterInit() method here :-|
						// Will have to wait 250 MS
						setTimeout(() => {
							self.$store.dispatch('setActive', {
								activeIndex : this.activeIndex,
								activeMediaItem : fileList[this.activeIndex],
								activeHTMLElement : $('.swiper-slide-active .viewer__media')
							});
							self.$bus.$emit('swiper:init');
						}, 250);
					},
					slideChangeTransitionStart : function() {
						self.$bus.$emit('swiper:slideChangeTransitionStart');
						self.$store.dispatch('setInTransition');
						self.$store.dispatch('setReady');
					},
					slideChangeTransitionEnd : function () {
						self.$store.dispatch('setTransitionEnd');
						self.$store.dispatch('setActive', {
							activeIndex : this.activeIndex,
							activeMediaItem : fileList[this.activeIndex],
							activeHTMLElement : $('.swiper-slide-active .viewer__media')
						});
						// Nur wenn wirklich eine andere Datei gemeint ist: bei
						// einem einzelnen Bild feuert der Wechsel auch fuer
						// die Datei, auf der die Adresse schon steht, und
						// vue-router meldet das als Fehler ("Avoided redundant
						// navigation to current location").
						const naechste = fileList[this.activeIndex].name;
						if (self.$route.params.file !== naechste) {
							self.$router.push({
								params: {
									file : naechste
								}
							});
						}
						self.$bus.$emit('swiper:slideChangeTransitionEnd');

						// --- pause all playing videos
						self.pauseAllVideos();
					}
				}
			});

			this.$nextTick(() => {
				// FF and IE11 Fix
				this.swiper.update();
				// Fokus in den Dialog, damit Tastatur und Sprachausgabe dort
				// ankommen und nicht in der verdeckten Dateiliste bleiben
				this.$el.focus({ preventScroll : true });
			});
		});
		document.addEventListener('keydown', this._trapFocus, true);
	},
	deactivated () {
		document.removeEventListener('keydown', this._trapFocus, true);
		const zuletzt = this.$store.state.activeMediaItem && this.$store.state.activeMediaItem.name;
		this.swiper.destroy();
		this.$store.dispatch('resetAll');
		this.list = null;
		this.failed = {};
		this._restoreFocus(zuletzt);
	},

	mounted () {
		this.$bus.$on('swiper:slideTo', (to) => {
			if (to === 'next') {
				this.swiper.slideNext();
			}
			else if (to === 'prev') {
				this.swiper.slidePrev();
			}
			else if (typeof to === 'number') {
				this.swiper.slideTo(to);
			}
		});

		document.addEventListener('fullscreenchange', () => {
			this.$store.dispatch('setVideoState', {
				isFullscreen : document.fullscreen
			});
		});
	},

	computed: {
		dialogLabel () {
			const item = this.$store.state.activeMediaItem;
			return (item && item.name) ? item.name : this.t('Loading');
		},
		slideIsVideo () {
			return this.$store.getters.itemType === 'video';
		},

		slideIsImage () {
			return this.$store.getters.itemType === 'image';
		},

		isFullscreen () {
			return this.$store.state.video.isFullscreen;
		},

		isPaused () {
			return this.$store.state.video.isPaused;
		},

		thumbDimensions() {
			let width = $(window).width();
			switch (true) {
			case (width <= 1024) : return 1024;
			case (width <= 1280) : return 1280;
			case (width <= 1920) : return 1920;
			case (width <= 2160) : return 2160;
			default: return 3840;
			}
		}
	}
};
</script>

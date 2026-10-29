<template>
	<div>
		<transition name="fade">
			<button v-show="isPaused && !isLoading && !isInTransition" class="viewer__video-overlay icon__play_circle" @click="togglePlay()" aria-hidden="true" tabindex="-1"></button>
		</transition>
		<section class="viewer__controls viewer__controls--video">
			<span class="viewer__control__nametag" id="files_mediaviewer-video-name" v-text="name"></span>
			<div class="viewer__control__scrubber" role="slider" tabindex="0" aria-labelledby="files_mediaviewer-video-name" aria-valuemin="0" :aria-valuemax="durationRounded" :aria-valuenow="Math.min(currentTime, durationRounded)" :aria-valuetext="showTimeInfo()" @click="skipTo(mousePos)" @keydown="seekKey($event)">
				<div :style="scrubberPosition"></div>
			</div>
			<nav-controls class="viewer__controls__subgroup">
				<!-- Swipe controls -->
			</nav-controls>
			<div class="viewer__controls__subgroup">
				<span class="viewer__control__count" v-text="showTimeInfo()"></span>
				<button class="viewer__control icon__replay" :disabled="currentTime === 0" @click="skipTo(0)" v-translate>Replay</button>
				<button class="viewer__control icon__play" :class="[isPaused ? 'icon__play' : 'icon__pause']" :aria-pressed="isPaused ? 'false' : 'true'" @click="togglePlay()" v-translate>Play</button>
				<button class="viewer__control" :class="[isMuted ? 'icon__volume_down' : 'icon__volume_up']" :aria-pressed="isMuted ? 'true' : 'false'" @click="toggleSound()" v-translate>Mute</button>
				<button class="viewer__control icon__fullscreen" v-if="documentFullscreenEnabled" @click="requestFullscreen()" v-translate>Fullscreen</button>
			</div>
			<meta-controls class="viewer__controls__subgroup">
				<!-- Swipe controls -->
			</meta-controls>
		</section>
	</div>
</template>
<script>
import ViewerControlsNavigate from './ViewerControlsNavigate.vue';
import ViewerControlsMeta from './ViewerControlsMeta.vue';
import './getEventListeners';

export default {
	name : 'VideoControls',
	components : {
		navControls  : ViewerControlsNavigate,
		metaControls : ViewerControlsMeta
	},
	data () {
		return {
			currentTime : {
				type    : Number,
				default : 0
			},
			duration    : {
				type    : Number,
				default : 0
			},
			mousePos    : {
				type    : Number,
				default : 0
			}
		};
	},
	methods : {
		togglePlay () {
			if (this.$video.paused) {
				this.$video.play();
			}
			else {
				this.$video.pause();
			}
		},

		toggleSound () {
			if (this.$video.muted) {
				this.$video.muted = false;
				this.$store.dispatch('setVideoState', {
					isMuted : false
				});
			}
			
			else {
				this.$video.muted = true;
				this.$store.dispatch('setVideoState', {
					isMuted : true
				});
			}
		},

		requestFullscreen () {
			if (document.fullscreenEnabled) this.$video.requestFullscreen();
			else if (document.webkitFullscreenEnabled) this.$video.webkitRequestFullscreen();
			else if (document.msFullscreenEnabled) this.$video.msRequestFullscreen();
			else return false
		},

		// Zeitleiste als Schieberegler: Pfeile spulen in kleinen Schritten, Bild
		// auf/ab um ein Zehntel, Pos1/Ende an Anfang und Schluss.
		seekKey (e) {
			const d = this.$video ? this.$video.duration : 0;
			if (!d || isNaN(d)) {
				return;
			}
			const schritt = Math.max(1, Math.min(10, d / 20));
			const jetzt = this.$video.currentTime;
			let ziel;
			switch (e.key) {
			case 'ArrowRight':
			case 'ArrowUp':
				ziel = jetzt + schritt;
				break;
			case 'ArrowLeft':
			case 'ArrowDown':
				ziel = jetzt - schritt;
				break;
			case 'PageUp':
				ziel = jetzt + d / 10;
				break;
			case 'PageDown':
				ziel = jetzt - d / 10;
				break;
			case 'Home':
				ziel = 0;
				break;
			case 'End':
				ziel = d;
				break;
			default:
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			this.skipTo(Math.min(d, Math.max(0, ziel)));
			this.currentTime = Math.round(this.$video.currentTime);
		},
		skipTo (seconds) {
			this.duration           = this.$video.duration;
			this.$video.currentTime = seconds;
			this.$store.dispatch('setLoading');
		},


		init () {
			if (!this.$video || !this.isActive)
			{return;}

			this.duration    = this.$video.duration;
			this.currentTime = this.$video.currentTime;

			this.$store.dispatch('setVideoState', {
				isMuted : false
			});

			if (Object.keys(this.$video.getEventListeners()).length === 0) {
				this.$video.addEventListener('loadstart', this.handleLoadstart);
				this.$video.addEventListener('loadedmetadata', this.handleMetadata);
				this.$video.addEventListener('canplay', this.handleCanPlay);
				this.$video.addEventListener('pause', this.handlePause);
				this.$video.addEventListener('playing', this.handlePlaying);
				this.$video.addEventListener('stalled', this.handlePause);
				this.$video.addEventListener('timeupdate', this.handleTimeupdate);
				this.$video.addEventListener('error', this.handleError);
			}

			this.$scrubber.addEventListener('mousemove', (event) => {
				let refPos = this.$scrubber.getBoundingClientRect(),
					pct    = (100 / refPos.width) * (event.pageX - refPos.left);

				this.mousePos = Math.round(pct / 100 * this.duration);
			});
		},

		handleError () {
			OC.Notification.show( this.t('Failed to load video data'), {type: 'error', timeout: 15})
			this.$store.dispatch('setVideoState', {
				source : 'addEventListener handlePause',
				isPaused : true
			});
		},

		handleMetadata () {
			this.duration = this.$video.duration;
		},
		handleLoadstart () {
			this.$store.dispatch('setLoading');
		},

		handleCanPlay () {
			this.$store.dispatch('setReady');
		},

		handlePause () {
			this.$store.dispatch('setVideoState', {
				source : 'addEventListener handlePause',
				isPaused : true
			});
		},

		handlePlaying () {
			this.duration = this.$video.duration;
			this.$store.dispatch('setVideoState', {
				source : 'addEventListener handlePlaying',
				isPaused : false
			});
		},

		handleTimeupdate () {
			this.currentTime = Math.round(this.$video.currentTime);
		},

		showTimeInfo() {
			let current = this.getDisplayTime(this.currentTime);
			let duration = this.totalDisplayTime;
			return `${current} / ${duration}`;
		}
	},
	mounted () {
		this.$bus.$on('swiper:slideChangeTransitionEnd', () => {
			this.init();
		});
		this.$bus.$on('swiper:init', () => {
			this.init();
		});
	},
	computed : {
		$video () {
			return this.$store.getters.HTMLVideoElement;
		},
		name () {
			return this.$store.getters.itemName;
		},

		isPaused () {
			return this.$store.state.video.isPaused;
		},

		isMuted () {
			return this.$store.state.video.isMuted;
		},

		isLoading () {
			return this.$store.state.isLoading;
		},

		isInTransition () {
			return this.$store.state.isInTransition;
		},

		documentFullscreenEnabled () {
			return document.fullscreenEnabled || document.webkitFullscreenEnabled || document.msFullscreenEnabled
		},

		scrubberPosition () {
			let width = (this.currentTime === 0) ? 0 : (100 / this.duration) * this.currentTime;

			if (width > 100) {
				width = 100;
			}
			else if (isNaN(width)) {
				width = 0;
			}
			else {
				width = Math.round(width);
			}

			return `width:${width}%`;
		},
		$scrubber () {
			return $('.viewer__control__scrubber').get(0);
		},

		durationRounded () {
			const d = Math.round(this.duration);
			return isNaN(d) ? 0 : d;
		},
		totalDisplayTime () {
			// this.duration is not rounded as opposed to this.currentTime
			let duration = Math.round(this.duration);
			return this.getDisplayTime(duration);
		}
	}
};
</script>

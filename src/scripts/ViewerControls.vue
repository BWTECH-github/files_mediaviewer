<template>
	<div>
		<ViewerControlsVideo v-show="slideIsVideo" />
		<ViewerControlsImage v-show="slideIsImage" />
		<spinner :show="isLoading"></spinner>
	</div>
</template>
<script>
import ViewerControlsVideo   from './ViewerControlsVideo.vue';
import ViewerControlsImage   from './ViewerControlsImage.vue';
export default {
	name : 'Controls',
	components : {
		ViewerControlsVideo,
		ViewerControlsImage
	},
	mounted () {
		// Pfeiltasten blättern beim Drücken, nicht beim Loslassen: Alt+Pfeil
		// (Cmd+Pfeil am Mac) ist Zurück/Vorwärts des Browsers, und dem folgt der
		// Betrachter über die Adresse. Beim Loslassen ist Alt oft schon oben,
		// der Betrachter blätterte dann ein zweites Mal und legte dabei einen
		// neuen Eintrag in der Chronik an.
		$(document).on('keydown', (e) => {
			// Gehaltene Taste: ein Schritt je Druck. jQuery reicht "repeat" nicht
			// durch, deshalb vom ursprünglichen Ereignis.
			if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (e.originalEvent && e.originalEvent.repeat)) {
				return;
			}
			// Pfeiltasten auf der Zeitleiste spulen das Video, sie blättern nicht
			if (e.target && e.target.closest && e.target.closest('[role=slider], input, textarea, select, [contenteditable]')) {
				return;
			}
			if (e.which === 39 && this.isActive) {
				this.$bus.$emit('swiper:slideTo', 'next');
			}
			else if (e.which === 37 && this.isActive) {
				this.$bus.$emit('swiper:slideTo', 'prev');
			}
		});

		this.$bus.$on('swiper:slideChangeTransitionEnd', () => {
			// Reset styles on transformed images
			$('.viewer__media--image[style]').removeAttr('style');
		});

	},
	computed : {
		controlComponent () {
			let component;

			if (this.slideIsVideo) {
				component = 'ViewerControlsVideo';
			}
			else if (this.slideIsImage) {
				component = 'ViewerControlsImage';
			}

			return component;
		},

		isLoading () {
			return this.$store.state.isLoading;
		},

		slideIsVideo () {
			return this.$store.getters.itemType === 'video';
		},

		slideIsImage () {
			return this.$store.getters.itemType === 'image';
		}
	}
};
</script>

<template>
	<div>
		<button class="viewer__control icon__download" @click="download()" v-translate>Download</button>
		<button class="viewer__control icon__close" @click="closeViewer()" v-translate>Close</button>
	</div>
</template>
<script>
export default {
	mounted () {
		$(document).on('keyup', (e) => {
			if (e.which === 27) {
				this.closeViewer();
			}
		});
	},
	methods : {
		// @TODO: make path creation a helper
		download () {
			let webdavPath;
			let item = this.$store.state.activeMediaItem;

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

				// Pfad kodieren wie beim Abspielen (Viewer.vue): unkodiert
				// schnitten "#" und "?" im Datei- oder Ordnernamen die Adresse ab,
				// "%" verfälschte sie - der Download landete auf einer 404-Seite
				// statt der Datei.
				webdavPath = OC.encodePath(path);
			}

			OC.redirect(webdavPath);
		}
	}
};
</script>

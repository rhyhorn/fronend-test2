(function () {
	'use strict';

	/**
	 * Helper for smooth scroll animation 
	 */
	function scrollTo(element, to, duration) {
		return new Promise((resolve) => {
			let start = element.scrollTop;
			let change = to - start;

			let currentTime = 0;
			let increment = 20;

			let easeInOutQuad = function (t, b, c, d) {
				t /= d / 2;
				if (t < 1) {
					return c / 2 * t * t + b;
				}
				t--;
				return -c / 2 * (t * (t - 2) - 1) + b;
			};

			let animateScroll = function () {
				currentTime += increment;
				let val = easeInOutQuad(currentTime, start, change, duration);
				element.scrollTop = val;

				if (currentTime < duration) {
					setTimeout(animateScroll, increment);
				} else {
					resolve();
				}
			};
			animateScroll();
		});
	}

	
	/**
	 * 
	 */
	const FLICKR_API_KEY = 'a1b91cc8f9bbdf6293d29b8decad9981';
	
	class FlickrAPI {
		constructor() {
			this.APIUrl = `https://api.flickr.com/services/rest/?format=json&api_key=${FLICKR_API_KEY}`;
		}

		getPhotos(perPage, page) {
			let url = `${this.APIUrl}&method=flickr.photos.getRecent&per_page=${perPage}&page=${page}&nojsoncallback=1`;

			return fetch(url)
				.then((response) => {
					return response.json();
				})
				.then((response) => {
					return response.photos;
				});
		}
	}

	/**
	 * 
	 */

	const ITEMS_IN_ROW = 5;
	const ITEMS_COUNT = 25;
	const ITEM_HEIGHT = 210;
	const VIEW_HEIGHT = 600;

	const UP_ARROW = 38;
	const RIGHT_ARROW = 39;
	const DOWN_ARROW = 40;
	const LEFT_ARROW = 37;

	class PhotoList {
		constructor(element, options) {
			this.element = element;
			this.photos = [];
			this.activeIndex = null;
			this.currentPage = 0;
			this.isRequestPhoto = false;
			this.isAnimate = false;

			this.flickrApi = new FlickrAPI();
			this.getPhotos()
				.then((photos) => {
					this.appendPhotos(photos);
					this.setActiveIndex(0);
				});

			document.addEventListener(
				'keyup',
				this.handleKeyboard.bind(this)
			);

			this.element.addEventListener(
				'wheel',
				this.handleScroll.bind(this)
			);
		}

		handleKeyboard(event) {
			switch (event.keyCode) {
				case RIGHT_ARROW: {
					this.updateList(this.activeIndex + 1);

					break;
				}
				case LEFT_ARROW: {
					this.updateList(this.activeIndex - 1);

					break;
				}
				case UP_ARROW: {
					this.updateList(this.activeIndex - ITEMS_IN_ROW);

					break;
				}
				case DOWN_ARROW: {
					this.updateList(this.activeIndex + ITEMS_IN_ROW);

					break;
				}
			}
		}

		handleScroll(event) {
			if (event.wheelDeltaY > 0) {
				this.updateList(this.activeIndex - ITEMS_IN_ROW);
			} else {
				this.updateList(this.activeIndex + ITEMS_IN_ROW);
			}
		}

		calculateScrollOffset() {
			let currentRow = Math.floor(this.activeIndex / ITEMS_IN_ROW);
			let offset = (currentRow * ITEM_HEIGHT) - (VIEW_HEIGHT / 2) + (ITEM_HEIGHT / 2);

			return offset;
		}

		updateScrollPosition() {
			let offset = this.calculateScrollOffset();

			if (this.element.scrollTop === offset) {
				return Promise.resolve();
			}

			this.isAnimate = true;
			return scrollTo(this.element, offset, 500)
				.then(() => { this.isAnimate = false; });
		}

		getPhotos() {
			this.isRequestPhoto = true;
			return this.flickrApi
				.getPhotos(ITEMS_COUNT, this.currentPage + 1)
				.then((photos) => {
					this.isRequestPhoto = false;
					return photos.photo;
				});
		}

		updateList(index) {
			if (this.isAnimate === true) {
				return;
			}

			let direction = this.activeIndex - index;
			let animatePromise = this.setActiveIndex(index);

			if (this.isRequestPhoto === true
				|| direction === 0
			) {
				return;
			}

			let currentRow = Math.floor(index / ITEMS_IN_ROW);
			let rowCount = Math.floor((this.photos.length - 1) / ITEMS_IN_ROW);
			let action = null;

			if (currentRow === (rowCount - 1)
				&& direction < 0
			) {
				this.currentPage++;
				action = this.updateNextPhotos.bind(this);
			}

			if ((currentRow === 1 || currentRow === 0)
				&& this.currentPage !== 0
				&& direction > 0
			) {
				this.currentPage--;
				action = this.updatePreviousPhotos.bind(this);
			}

			if (action === null) {
				return;
			}

			Promise.all([
				this.getPhotos(),
				animatePromise
			]).then(([photos]) => {
				action(photos)
			});
		}

		updateNextPhotos(photos) {
			let count = this.photos.length;
			let toRemove = this.photos
				.splice(0, count - (3 * ITEMS_IN_ROW));

			toRemove.forEach((photo) => {
				this.element.removeChild(photo.getElement());
			});

			this.activeIndex -= toRemove.length;

			let offset = this.calculateScrollOffset();
			this.element.scrollTop = offset;
			this.appendPhotos(photos);
		}

		updatePreviousPhotos(photos) {
			let count = this.photos.length;
			let parent = this.photos[0];
			let toRemove = this.photos
				.splice(count - (3 * ITEMS_IN_ROW));

			toRemove.forEach((photo) => {
				this.element.removeChild(photo.getElement());
			});


			photos = photos.slice(0, photos.length - (3 * ITEMS_IN_ROW))
				.map((photoData) => {
					return new Photo(photoData);
				});


			this.photos = photos.concat(this.photos);
			this.activeIndex += photos.length;

			photos.forEach((photo, index) => {
				return this.element.insertBefore(
					photo.getElement(),
					parent.getElement()
				);
			});
		}

		setActiveIndex(index) {
			if (index >= this.photos.length) {
				index = this.photos.length - 1;
			}

			if (index <= 0) {
				index = 0;
			}

			if (this.photos[index] === undefined) {
				return Promise.resolve();
			}

			if (this.activeIndex !== null
				&& this.photos[this.activeIndex] !== undefined
			) {
				this.photos[this.activeIndex]
					.setActive(false);
			}

			this.activeIndex = index;
			this.photos[index].setActive(true);

			return this.updateScrollPosition();
		}

		appendPhotos(photos) {
			photos = photos.map((photoData) => {
				return new Photo(photoData);
			});
			this.photos = this.photos.concat(photos);
			photos.forEach((photo) => {
				return this.element.appendChild(photo.getElement());
			});
		}
	}

	/**
	 * 
	 */
	const ACTIVE_CLASS = 'photo--active';

	class Photo {
		constructor(data) {
			this.isActive = false;
			this.photoUrl = `https://farm${data.farm}.staticflickr.com/${data.server}/${data.id}_${data.secret}.jpg`;
			this.element = document.createElement('div');
			this.element.className = 'photo-list__item';
			this.element.innerHTML = this.render();
		}

		getElement() {
			return this.element;
		}

		setActive(isActive) {
			if (isActive === true) {
				this.element.classList.add(ACTIVE_CLASS);
				return;
			}
			this.element.classList.remove(ACTIVE_CLASS);
		}

		render() {
			return `
				<div class="photo">
					<img src="${this.photoUrl}" />
				</div>
			`;
		}
	}

	/**
	 * Initialization
	 */
	document.addEventListener('DOMContentLoaded', function () {
		let element = document.querySelector('[data-widget=PhotoList]');
		if (element === null) {
			return;
		}

		element.dataset.widget = new PhotoList(element, {});
	});

})(window);
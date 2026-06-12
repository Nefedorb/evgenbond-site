(() => {
    "use strict";

    function loadHoverPortrait() {
        if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

        const picture = document.querySelector("[data-hover-picture]");
        if (!picture) return;

        const source = picture.querySelector("source[data-srcset]");
        const image = picture.querySelector("img[data-src]");
        if (!source || !image) return;

        const load = () => {
            source.srcset = source.dataset.srcset;
            image.addEventListener("load", () => {
                picture.classList.add("is-loaded");
                picture.closest(".hero-photo-box")?.classList.add("has-hover-photo");
            }, { once: true });
            image.src = image.dataset.src;
        };

        if (document.readyState === "complete") {
            load();
        } else {
            window.addEventListener("load", load, { once: true });
        }
    }

    function initVideoPreview() {
        const preview = document.querySelector("[data-video-preview]");
        if (!preview) return;

        preview.addEventListener("click", () => {
            const iframe = document.createElement("iframe");
            iframe.src = preview.dataset.videoSrc;
            iframe.title = preview.dataset.videoTitle;
            iframe.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; screen-wake-lock";
            iframe.referrerPolicy = "strict-origin-when-cross-origin";
            iframe.allowFullscreen = true;

            preview.replaceWith(iframe);
        }, { once: true });
    }

    loadHoverPortrait();
    initVideoPreview();
})();

(() => {
    "use strict";

    const CONSENT_KEY = "evgenbond.cookieConsent.v1";
    const METRIKA_ID = 107739439;

    function hasConsent() {
        try {
            return window.localStorage.getItem(CONSENT_KEY) === "accepted";
        } catch {
            return false;
        }
    }

    function saveConsent() {
        try {
            window.localStorage.setItem(CONSENT_KEY, "accepted");
        } catch {
            // The current page still receives consent even if storage is unavailable.
        }
    }

    function loadMetrika() {
        if (window.__evgenbondMetrikaLoaded) return;
        window.__evgenbondMetrikaLoaded = true;

        window.ym = window.ym || function () {
            (window.ym.a = window.ym.a || []).push(arguments);
        };
        window.ym.l = Date.now();

        const script = document.createElement("script");
        script.async = true;
        script.src = `https://mc.yandex.ru/metrika/tag.js?id=${METRIKA_ID}`;
        document.head.appendChild(script);

        window.ym(METRIKA_ID, "init", {
            ssr: true,
            webvisor: true,
            clickmap: true,
            ecommerce: "dataLayer",
            referrer: document.referrer,
            url: window.location.href,
            accurateTrackBounce: true,
            trackLinks: true
        });
    }

    function showBanner() {
        const banner = document.createElement("section");
        banner.className = "cookie-consent";
        banner.setAttribute("aria-label", "Согласие на использование Cookie-файлов");
        banner.innerHTML = `
            <p class="cookie-consent__text">
                Сайт обрабатывает Cookie-файлы с целью персонализации сервисов и повышения удобства пользования веб-сайтом.
                На сайте используются веб-технологии для анонимного анализа и отслеживания целевой рекламы, в частности
                Яндекс Метрика. Применение Cookie-файлов требует вашего добровольного согласия. Ограничить их обработку
                можно в настройках браузера. Ознакомьтесь с
                <a class="cookie-consent__link" href="/cookie-policy/">Политикой использования Cookie-файлов</a>.
            </p>
            <button class="cookie-consent__accept" type="button">Принять</button>
        `;

        banner.querySelector(".cookie-consent__accept").addEventListener("click", () => {
            saveConsent();
            loadMetrika();
            banner.remove();
        });

        document.body.appendChild(banner);
    }

    function init() {
        if (hasConsent()) {
            loadMetrika();
        } else {
            showBanner();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();

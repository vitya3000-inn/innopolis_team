import { useEffect } from 'react';
import { Platform } from 'react-native';

/** Официальный сниппет Microsoft Clarity (только web). */
const CLARITY_SNIPPET = `(function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "wdjds0yyxn");`;

export function useMicrosoftClarity() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;
    if (document.querySelector('script[data-microsoft-clarity]')) return;
    const el = document.createElement('script');
    el.type = 'text/javascript';
    el.setAttribute('data-microsoft-clarity', '1');
    el.textContent = CLARITY_SNIPPET;
    document.head.appendChild(el);
  }, []);
}

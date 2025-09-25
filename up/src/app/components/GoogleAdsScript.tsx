// components/GoogleAdsScript.tsx
'use client';

import { useEffect } from 'react';

export default function GoogleAdsScript() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4001819101528400';
    script.crossOrigin = 'anonymous';
    script.async = true;

    document.head.appendChild(script);

    return () => {
      // Cleanup the script on unmount
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  return null;
}
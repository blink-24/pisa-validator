// 저장된 이미지 자산을 Object URL로 표시. 언마운트 시 revoke.

import { useEffect, useState } from 'react';
import { assetObjectUrl } from '../data/assets';

export function AssetImage({ assetId, alt }: { assetId: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    let current: string | null = null;
    assetObjectUrl(assetId).then((u) => {
      if (revoked) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      current = u;
      setUrl(u);
    });
    return () => {
      revoked = true;
      if (current) URL.revokeObjectURL(current);
    };
  }, [assetId]);

  if (!url) return null;
  return <img src={url} alt={alt} style={{ maxWidth: '100%', height: 'auto', borderRadius: 6 }} />;
}

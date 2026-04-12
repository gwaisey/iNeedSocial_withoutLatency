# Code Citations

## License: unknown
https://github.com/availabs/AvlMap/blob/f5174fc5a28475767ee92a93944e50bf8b391f57/components/AvlTable.js

```
Perfect! Now let's add **time-tracking logic** to your feed page using IntersectionObserver. This will track how long each post is visible and categorize by genre.

````typescript
// filepath: d:\GRACE\Projects\iNeedSocial_withoutLatency\app\pages\feed-page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import FeedCard from '@/components/feed/FeedCard';
import TimerOverlay from '@/components/timer/TimerOverlay';
import { fetchFeed } from '@/lib/api';

interface Post {
  id: string;
  type: string;
  genre: string;
  username: string;
  likes: string;
  caption: string;
  media: Array<{ src: string; alt: string }>;
}

interface GenreTime {
  humor: number;
  berita: number;
  wisata: number;
  makanan: number;
  olahraga: number;
  game: number;
}

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [showTimer, setShowTimer] = useState(false);
  const [genreTimes, setGenreTimes] = useState<GenreTime>({
    humor: 0,
    berita: 0,
    wisata: 0,
    makanan: 0,
    olahraga: 0,
    game: 0,
  });

  const sessionIdRef = useRef<string>('');
  const postTimersRef = useRef<Map<string, number>>(new Map());
  const postStartTimeRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    // Generate session ID
    sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Fetch feed data
    const loadFeed = async () => {
      const data = await fetchFeed();
      setPosts(data.posts);
    };
    loadFeed();
  }, []);

  useEffect(() => {
    // IntersectionObserver untuk tracking waktu post
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5, // Post dianggap visible jika 50% terlihat
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const postId = entry.target.getAttribute('data-post-id');
        const genre = entry.target.getAttribute('data-genre') as keyof GenreTime;

        if (!postId || !genre) return;

        if (entry.isIntersecting) {
          // Post mulai visible
          postStartTimeRef.current.set(postId, Date.now());
        } else {
          // Post tidak visible lagi, hitung waktunya
          const startTime = postStartTimeRef.current.get(postId);
          if (startTime) {
            const duration = Date.now() - startTime;
            const currentTime = postTimersRef.current.get(postId) || 0;
            postTimersRef.current.set(postId, currentTime + duration);

            // Update genre time
            setGenreTimes((prev) => ({
              ...prev,
              [genre]: prev[genre] + duration,
            }));

            postStartTimeRef.current.delete(postId);
          }
        }
      });
    }, observerOptions);

    // Observe semua post
    const postElements = document.querySelectorAll('[data-post-id]');
    postElements.forEach((el) => observer.observe(el));

    return () => {
      postElements.forEach((el) => observer.unobserve(el));
    };
  }, [posts]);

  // Handle saat user buka timer overlay
  const handleOpenTimer = async () => {
    // Stop tracking posts yang masih visible
    postStartTimeRef.current.forEach((startTime, postId) => {
      const duration = Date.now() - startTime;
      const genre = document.querySelector(`[data-post-id="${postId}"]`)?.getAttribute('data-genre') as keyof GenreTime;
      if (genre) {
        const currentTime = postTimersRef.current.get(postId) || 0;
        postTimersRef.current.set(postId, currentTime + duration);
        setGenreTimes((prev) => ({
          ...prev,
          [genre]: prev[genre] + duration,
        }));
      }
    });
    postStartTimeRef.current.clear();

    setShowTimer(true);

    // Send data to Google Sheets
    await sendDataToGoogleSheets();
  };

  const sendDataToGoogleSheets = async () => {
    const totalTime = Object.values(genreTimes).reduce((a, b) => a + b, 0);

    const payload = {
      timestamp: new Date().toISOString(),
      session_id: sessionIdRef.current,
      total_time: totalTime,
      humor_ms: genreTimes.humor,
      berita_ms: genreTimes.berita,
      wisata_ms: genreTimes.wisata,
      makanan_ms: genreTimes.makanan,
      olahraga_ms: genreTimes.olahraga,
      game_ms: genreTimes.game,
      app_version: 'without_latency', // ubah sesuai dengan versi app
    };

    try {
      // Ganti dengan Google Apps Script endpoint Anda
      const response = await fetch('YOUR_GOOGLE_APPS_SCRIPT_URL', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('Data sent to Google Sheets');
    } catch (error) {
      console.error('Failed to send data:', error);
    }
  };

  const handleCloseTimer = () => {
    setShowTimer(false);
    // Resume tracking
    const postElements = document.querySelectorAll('[data-post-id]');
    postElements.forEach((el) => {
      const postId = el.getAttribute('data-post-id');
      if (postId && !postStartTimeRef.current.has(postId)) {
        // Check if currently visible
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          postStartTimeRef.current.set(postId, Date.now());
        }
      }
    });
  };

  return (
    <div className="feed-container">
      <div className="posts-list">
        {posts.map((post) => (
          <div
            key={post.id}
            data-post-id={post.id}
            data-genre={post.genre}
            className="post-wrapper"
          >
            <FeedCard post={post} />
          </div>
        ))}
      </div>

      {/* Timer Button */}
      <button
        onClick={handleOpenTimer}
        className="timer-button"
        aria-label="Open timer overlay"
      >
        ⏱️ {Math.floor(Object.values(genreTimes).reduce((a, b) => a + b, 0) / 1000)}s
      </button>

      {/* Timer Overlay */}
      {showTimer && (
        <TimerOverlay
          genreTimes={genreTimes}
          onClose={handleCloseTimer}
          sessionId={sessionIdRef.current}
        />
      )}
    </div>
  );
}
````

Now create the **TimerOverlay component** yang menampilkan breakdown per genre:

````typescript
// filepath: d:\GRACE\Projects\iNeedSocial_withoutLatency\components\timer\TimerOverlay.tsx
'use client';

import { useEffect, useState } from 'react';
import './TimerOverlay.css';

interface TimerOverlayProps {
  genreTimes: {
    humor: number;
    berita: number;
    wisata: number;
    makanan: number;
    olahraga: number;
    game: number;
  };
  onClose: () => void;
  sessionId: string;
}

export default function TimerOverlay({ genreTimes, onClose, sessionId }: TimerOverlayProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const genres = [
    { key: 'humor', label: '😂 Humor', color: '#FF6B6B' },
    { key: 'berita', label: '📰 Berita', color: '#4ECDC4' },
    { key: 'wisata', label: '✈️ Wisata', color: '#45B7D1' },
    { key: 'makanan', label: '🍔 Makanan', color: '#FFA07A' },
    { key: 'olahraga', label: '⚽ Olahraga', color: '#98D8C8' },
    { key: 'game', label: '🎮 Game', color: '#F7DC6F' },
  ];

  const totalTime = Object.values(genreTimes).reduce((a, b) => a + b, 0);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const getPercentage = (time: number) => {
    return totalTime > 0 ? ((time / totalTime) * 100).toFixed(1) : '0';
  };

  const downloadReport = () => {
    setIsDownloading(true);

    // Create CSV data
    const csvContent = [
      ['Genre', 'Time (ms)', 'Time (formatted)', 'Percentage'],
      ...genres.map((g) => [
        g.label,
        genreTimes[g.key as keyof typeof genreTimes],
        formatTime(genreTimes[g.key as keyof typeof genreTimes]),
        `${getPercentage(genreTimes[g.key as keyof typeof genreTimes])}%`,
      ]),
      [],
      ['Total Time', totalTime, formatTime(totalTime), '100%'],
      ['Session ID', sessionId],
      ['Timestamp', new Date().toISOString()],
    ];

    const csv = csvContent.map((row) => row.join(',')).join('\n');

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `report_${sessionId}.csv`);
    link.style.visibility = 'hidden';
    document
```


## License: unknown
https://github.com/HausDAO/daohaus-app/blob/c50207b6bea7f9e429df7e25b9355481dc6f5990/src/utils/csv.js

```
Perfect! Now let's add **time-tracking logic** to your feed page using IntersectionObserver. This will track how long each post is visible and categorize by genre.

````typescript
// filepath: d:\GRACE\Projects\iNeedSocial_withoutLatency\app\pages\feed-page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import FeedCard from '@/components/feed/FeedCard';
import TimerOverlay from '@/components/timer/TimerOverlay';
import { fetchFeed } from '@/lib/api';

interface Post {
  id: string;
  type: string;
  genre: string;
  username: string;
  likes: string;
  caption: string;
  media: Array<{ src: string; alt: string }>;
}

interface GenreTime {
  humor: number;
  berita: number;
  wisata: number;
  makanan: number;
  olahraga: number;
  game: number;
}

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [showTimer, setShowTimer] = useState(false);
  const [genreTimes, setGenreTimes] = useState<GenreTime>({
    humor: 0,
    berita: 0,
    wisata: 0,
    makanan: 0,
    olahraga: 0,
    game: 0,
  });

  const sessionIdRef = useRef<string>('');
  const postTimersRef = useRef<Map<string, number>>(new Map());
  const postStartTimeRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    // Generate session ID
    sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Fetch feed data
    const loadFeed = async () => {
      const data = await fetchFeed();
      setPosts(data.posts);
    };
    loadFeed();
  }, []);

  useEffect(() => {
    // IntersectionObserver untuk tracking waktu post
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5, // Post dianggap visible jika 50% terlihat
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const postId = entry.target.getAttribute('data-post-id');
        const genre = entry.target.getAttribute('data-genre') as keyof GenreTime;

        if (!postId || !genre) return;

        if (entry.isIntersecting) {
          // Post mulai visible
          postStartTimeRef.current.set(postId, Date.now());
        } else {
          // Post tidak visible lagi, hitung waktunya
          const startTime = postStartTimeRef.current.get(postId);
          if (startTime) {
            const duration = Date.now() - startTime;
            const currentTime = postTimersRef.current.get(postId) || 0;
            postTimersRef.current.set(postId, currentTime + duration);

            // Update genre time
            setGenreTimes((prev) => ({
              ...prev,
              [genre]: prev[genre] + duration,
            }));

            postStartTimeRef.current.delete(postId);
          }
        }
      });
    }, observerOptions);

    // Observe semua post
    const postElements = document.querySelectorAll('[data-post-id]');
    postElements.forEach((el) => observer.observe(el));

    return () => {
      postElements.forEach((el) => observer.unobserve(el));
    };
  }, [posts]);

  // Handle saat user buka timer overlay
  const handleOpenTimer = async () => {
    // Stop tracking posts yang masih visible
    postStartTimeRef.current.forEach((startTime, postId) => {
      const duration = Date.now() - startTime;
      const genre = document.querySelector(`[data-post-id="${postId}"]`)?.getAttribute('data-genre') as keyof GenreTime;
      if (genre) {
        const currentTime = postTimersRef.current.get(postId) || 0;
        postTimersRef.current.set(postId, currentTime + duration);
        setGenreTimes((prev) => ({
          ...prev,
          [genre]: prev[genre] + duration,
        }));
      }
    });
    postStartTimeRef.current.clear();

    setShowTimer(true);

    // Send data to Google Sheets
    await sendDataToGoogleSheets();
  };

  const sendDataToGoogleSheets = async () => {
    const totalTime = Object.values(genreTimes).reduce((a, b) => a + b, 0);

    const payload = {
      timestamp: new Date().toISOString(),
      session_id: sessionIdRef.current,
      total_time: totalTime,
      humor_ms: genreTimes.humor,
      berita_ms: genreTimes.berita,
      wisata_ms: genreTimes.wisata,
      makanan_ms: genreTimes.makanan,
      olahraga_ms: genreTimes.olahraga,
      game_ms: genreTimes.game,
      app_version: 'without_latency', // ubah sesuai dengan versi app
    };

    try {
      // Ganti dengan Google Apps Script endpoint Anda
      const response = await fetch('YOUR_GOOGLE_APPS_SCRIPT_URL', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('Data sent to Google Sheets');
    } catch (error) {
      console.error('Failed to send data:', error);
    }
  };

  const handleCloseTimer = () => {
    setShowTimer(false);
    // Resume tracking
    const postElements = document.querySelectorAll('[data-post-id]');
    postElements.forEach((el) => {
      const postId = el.getAttribute('data-post-id');
      if (postId && !postStartTimeRef.current.has(postId)) {
        // Check if currently visible
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          postStartTimeRef.current.set(postId, Date.now());
        }
      }
    });
  };

  return (
    <div className="feed-container">
      <div className="posts-list">
        {posts.map((post) => (
          <div
            key={post.id}
            data-post-id={post.id}
            data-genre={post.genre}
            className="post-wrapper"
          >
            <FeedCard post={post} />
          </div>
        ))}
      </div>

      {/* Timer Button */}
      <button
        onClick={handleOpenTimer}
        className="timer-button"
        aria-label="Open timer overlay"
      >
        ⏱️ {Math.floor(Object.values(genreTimes).reduce((a, b) => a + b, 0) / 1000)}s
      </button>

      {/* Timer Overlay */}
      {showTimer && (
        <TimerOverlay
          genreTimes={genreTimes}
          onClose={handleCloseTimer}
          sessionId={sessionIdRef.current}
        />
      )}
    </div>
  );
}
````

Now create the **TimerOverlay component** yang menampilkan breakdown per genre:

````typescript
// filepath: d:\GRACE\Projects\iNeedSocial_withoutLatency\components\timer\TimerOverlay.tsx
'use client';

import { useEffect, useState } from 'react';
import './TimerOverlay.css';

interface TimerOverlayProps {
  genreTimes: {
    humor: number;
    berita: number;
    wisata: number;
    makanan: number;
    olahraga: number;
    game: number;
  };
  onClose: () => void;
  sessionId: string;
}

export default function TimerOverlay({ genreTimes, onClose, sessionId }: TimerOverlayProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const genres = [
    { key: 'humor', label: '😂 Humor', color: '#FF6B6B' },
    { key: 'berita', label: '📰 Berita', color: '#4ECDC4' },
    { key: 'wisata', label: '✈️ Wisata', color: '#45B7D1' },
    { key: 'makanan', label: '🍔 Makanan', color: '#FFA07A' },
    { key: 'olahraga', label: '⚽ Olahraga', color: '#98D8C8' },
    { key: 'game', label: '🎮 Game', color: '#F7DC6F' },
  ];

  const totalTime = Object.values(genreTimes).reduce((a, b) => a + b, 0);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const getPercentage = (time: number) => {
    return totalTime > 0 ? ((time / totalTime) * 100).toFixed(1) : '0';
  };

  const downloadReport = () => {
    setIsDownloading(true);

    // Create CSV data
    const csvContent = [
      ['Genre', 'Time (ms)', 'Time (formatted)', 'Percentage'],
      ...genres.map((g) => [
        g.label,
        genreTimes[g.key as keyof typeof genreTimes],
        formatTime(genreTimes[g.key as keyof typeof genreTimes]),
        `${getPercentage(genreTimes[g.key as keyof typeof genreTimes])}%`,
      ]),
      [],
      ['Total Time', totalTime, formatTime(totalTime), '100%'],
      ['Session ID', sessionId],
      ['Timestamp', new Date().toISOString()],
    ];

    const csv = csvContent.map((row) => row.join(',')).join('\n');

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `report_${sessionId}.csv`);
    link.style.visibility = 'hidden';
    document
```


## License: unknown
https://github.com/hamoudyazen/shopify_scraper/blob/67b36eec981b2218ac5946213b96dda0b9137bb0/src/app/product-page/product-page.component.ts

```
Perfect! Now let's add **time-tracking logic** to your feed page using IntersectionObserver. This will track how long each post is visible and categorize by genre.

````typescript
// filepath: d:\GRACE\Projects\iNeedSocial_withoutLatency\app\pages\feed-page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import FeedCard from '@/components/feed/FeedCard';
import TimerOverlay from '@/components/timer/TimerOverlay';
import { fetchFeed } from '@/lib/api';

interface Post {
  id: string;
  type: string;
  genre: string;
  username: string;
  likes: string;
  caption: string;
  media: Array<{ src: string; alt: string }>;
}

interface GenreTime {
  humor: number;
  berita: number;
  wisata: number;
  makanan: number;
  olahraga: number;
  game: number;
}

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [showTimer, setShowTimer] = useState(false);
  const [genreTimes, setGenreTimes] = useState<GenreTime>({
    humor: 0,
    berita: 0,
    wisata: 0,
    makanan: 0,
    olahraga: 0,
    game: 0,
  });

  const sessionIdRef = useRef<string>('');
  const postTimersRef = useRef<Map<string, number>>(new Map());
  const postStartTimeRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    // Generate session ID
    sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Fetch feed data
    const loadFeed = async () => {
      const data = await fetchFeed();
      setPosts(data.posts);
    };
    loadFeed();
  }, []);

  useEffect(() => {
    // IntersectionObserver untuk tracking waktu post
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5, // Post dianggap visible jika 50% terlihat
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const postId = entry.target.getAttribute('data-post-id');
        const genre = entry.target.getAttribute('data-genre') as keyof GenreTime;

        if (!postId || !genre) return;

        if (entry.isIntersecting) {
          // Post mulai visible
          postStartTimeRef.current.set(postId, Date.now());
        } else {
          // Post tidak visible lagi, hitung waktunya
          const startTime = postStartTimeRef.current.get(postId);
          if (startTime) {
            const duration = Date.now() - startTime;
            const currentTime = postTimersRef.current.get(postId) || 0;
            postTimersRef.current.set(postId, currentTime + duration);

            // Update genre time
            setGenreTimes((prev) => ({
              ...prev,
              [genre]: prev[genre] + duration,
            }));

            postStartTimeRef.current.delete(postId);
          }
        }
      });
    }, observerOptions);

    // Observe semua post
    const postElements = document.querySelectorAll('[data-post-id]');
    postElements.forEach((el) => observer.observe(el));

    return () => {
      postElements.forEach((el) => observer.unobserve(el));
    };
  }, [posts]);

  // Handle saat user buka timer overlay
  const handleOpenTimer = async () => {
    // Stop tracking posts yang masih visible
    postStartTimeRef.current.forEach((startTime, postId) => {
      const duration = Date.now() - startTime;
      const genre = document.querySelector(`[data-post-id="${postId}"]`)?.getAttribute('data-genre') as keyof GenreTime;
      if (genre) {
        const currentTime = postTimersRef.current.get(postId) || 0;
        postTimersRef.current.set(postId, currentTime + duration);
        setGenreTimes((prev) => ({
          ...prev,
          [genre]: prev[genre] + duration,
        }));
      }
    });
    postStartTimeRef.current.clear();

    setShowTimer(true);

    // Send data to Google Sheets
    await sendDataToGoogleSheets();
  };

  const sendDataToGoogleSheets = async () => {
    const totalTime = Object.values(genreTimes).reduce((a, b) => a + b, 0);

    const payload = {
      timestamp: new Date().toISOString(),
      session_id: sessionIdRef.current,
      total_time: totalTime,
      humor_ms: genreTimes.humor,
      berita_ms: genreTimes.berita,
      wisata_ms: genreTimes.wisata,
      makanan_ms: genreTimes.makanan,
      olahraga_ms: genreTimes.olahraga,
      game_ms: genreTimes.game,
      app_version: 'without_latency', // ubah sesuai dengan versi app
    };

    try {
      // Ganti dengan Google Apps Script endpoint Anda
      const response = await fetch('YOUR_GOOGLE_APPS_SCRIPT_URL', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('Data sent to Google Sheets');
    } catch (error) {
      console.error('Failed to send data:', error);
    }
  };

  const handleCloseTimer = () => {
    setShowTimer(false);
    // Resume tracking
    const postElements = document.querySelectorAll('[data-post-id]');
    postElements.forEach((el) => {
      const postId = el.getAttribute('data-post-id');
      if (postId && !postStartTimeRef.current.has(postId)) {
        // Check if currently visible
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          postStartTimeRef.current.set(postId, Date.now());
        }
      }
    });
  };

  return (
    <div className="feed-container">
      <div className="posts-list">
        {posts.map((post) => (
          <div
            key={post.id}
            data-post-id={post.id}
            data-genre={post.genre}
            className="post-wrapper"
          >
            <FeedCard post={post} />
          </div>
        ))}
      </div>

      {/* Timer Button */}
      <button
        onClick={handleOpenTimer}
        className="timer-button"
        aria-label="Open timer overlay"
      >
        ⏱️ {Math.floor(Object.values(genreTimes).reduce((a, b) => a + b, 0) / 1000)}s
      </button>

      {/* Timer Overlay */}
      {showTimer && (
        <TimerOverlay
          genreTimes={genreTimes}
          onClose={handleCloseTimer}
          sessionId={sessionIdRef.current}
        />
      )}
    </div>
  );
}
````

Now create the **TimerOverlay component** yang menampilkan breakdown per genre:

````typescript
// filepath: d:\GRACE\Projects\iNeedSocial_withoutLatency\components\timer\TimerOverlay.tsx
'use client';

import { useEffect, useState } from 'react';
import './TimerOverlay.css';

interface TimerOverlayProps {
  genreTimes: {
    humor: number;
    berita: number;
    wisata: number;
    makanan: number;
    olahraga: number;
    game: number;
  };
  onClose: () => void;
  sessionId: string;
}

export default function TimerOverlay({ genreTimes, onClose, sessionId }: TimerOverlayProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const genres = [
    { key: 'humor', label: '😂 Humor', color: '#FF6B6B' },
    { key: 'berita', label: '📰 Berita', color: '#4ECDC4' },
    { key: 'wisata', label: '✈️ Wisata', color: '#45B7D1' },
    { key: 'makanan', label: '🍔 Makanan', color: '#FFA07A' },
    { key: 'olahraga', label: '⚽ Olahraga', color: '#98D8C8' },
    { key: 'game', label: '🎮 Game', color: '#F7DC6F' },
  ];

  const totalTime = Object.values(genreTimes).reduce((a, b) => a + b, 0);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const getPercentage = (time: number) => {
    return totalTime > 0 ? ((time / totalTime) * 100).toFixed(1) : '0';
  };

  const downloadReport = () => {
    setIsDownloading(true);

    // Create CSV data
    const csvContent = [
      ['Genre', 'Time (ms)', 'Time (formatted)', 'Percentage'],
      ...genres.map((g) => [
        g.label,
        genreTimes[g.key as keyof typeof genreTimes],
        formatTime(genreTimes[g.key as keyof typeof genreTimes]),
        `${getPercentage(genreTimes[g.key as keyof typeof genreTimes])}%`,
      ]),
      [],
      ['Total Time', totalTime, formatTime(totalTime), '100%'],
      ['Session ID', sessionId],
      ['Timestamp', new Date().toISOString()],
    ];

    const csv = csvContent.map((row) => row.join(',')).join('\n');

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `report_${sessionId}.csv`);
    link.style.visibility = 'hidden';
    document
```


## License: unknown
https://github.com/availabs/AvlMap/blob/f5174fc5a28475767ee92a93944e50bf8b391f57/components/AvlTable.js

```
Perfect! Now let's add **time-tracking logic** to your feed page using IntersectionObserver. This will track how long each post is visible and categorize by genre.

````typescript
// filepath: d:\GRACE\Projects\iNeedSocial_withoutLatency\app\pages\feed-page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import FeedCard from '@/components/feed/FeedCard';
import TimerOverlay from '@/components/timer/TimerOverlay';
import { fetchFeed } from '@/lib/api';

interface Post {
  id: string;
  type: string;
  genre: string;
  username: string;
  likes: string;
  caption: string;
  media: Array<{ src: string; alt: string }>;
}

interface GenreTime {
  humor: number;
  berita: number;
  wisata: number;
  makanan: number;
  olahraga: number;
  game: number;
}

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [showTimer, setShowTimer] = useState(false);
  const [genreTimes, setGenreTimes] = useState<GenreTime>({
    humor: 0,
    berita: 0,
    wisata: 0,
    makanan: 0,
    olahraga: 0,
    game: 0,
  });

  const sessionIdRef = useRef<string>('');
  const postTimersRef = useRef<Map<string, number>>(new Map());
  const postStartTimeRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    // Generate session ID
    sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Fetch feed data
    const loadFeed = async () => {
      const data = await fetchFeed();
      setPosts(data.posts);
    };
    loadFeed();
  }, []);

  useEffect(() => {
    // IntersectionObserver untuk tracking waktu post
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5, // Post dianggap visible jika 50% terlihat
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const postId = entry.target.getAttribute('data-post-id');
        const genre = entry.target.getAttribute('data-genre') as keyof GenreTime;

        if (!postId || !genre) return;

        if (entry.isIntersecting) {
          // Post mulai visible
          postStartTimeRef.current.set(postId, Date.now());
        } else {
          // Post tidak visible lagi, hitung waktunya
          const startTime = postStartTimeRef.current.get(postId);
          if (startTime) {
            const duration = Date.now() - startTime;
            const currentTime = postTimersRef.current.get(postId) || 0;
            postTimersRef.current.set(postId, currentTime + duration);

            // Update genre time
            setGenreTimes((prev) => ({
              ...prev,
              [genre]: prev[genre] + duration,
            }));

            postStartTimeRef.current.delete(postId);
          }
        }
      });
    }, observerOptions);

    // Observe semua post
    const postElements = document.querySelectorAll('[data-post-id]');
    postElements.forEach((el) => observer.observe(el));

    return () => {
      postElements.forEach((el) => observer.unobserve(el));
    };
  }, [posts]);

  // Handle saat user buka timer overlay
  const handleOpenTimer = async () => {
    // Stop tracking posts yang masih visible
    postStartTimeRef.current.forEach((startTime, postId) => {
      const duration = Date.now() - startTime;
      const genre = document.querySelector(`[data-post-id="${postId}"]`)?.getAttribute('data-genre') as keyof GenreTime;
      if (genre) {
        const currentTime = postTimersRef.current.get(postId) || 0;
        postTimersRef.current.set(postId, currentTime + duration);
        setGenreTimes((prev) => ({
          ...prev,
          [genre]: prev[genre] + duration,
        }));
      }
    });
    postStartTimeRef.current.clear();

    setShowTimer(true);

    // Send data to Google Sheets
    await sendDataToGoogleSheets();
  };

  const sendDataToGoogleSheets = async () => {
    const totalTime = Object.values(genreTimes).reduce((a, b) => a + b, 0);

    const payload = {
      timestamp: new Date().toISOString(),
      session_id: sessionIdRef.current,
      total_time: totalTime,
      humor_ms: genreTimes.humor,
      berita_ms: genreTimes.berita,
      wisata_ms: genreTimes.wisata,
      makanan_ms: genreTimes.makanan,
      olahraga_ms: genreTimes.olahraga,
      game_ms: genreTimes.game,
      app_version: 'without_latency', // ubah sesuai dengan versi app
    };

    try {
      // Ganti dengan Google Apps Script endpoint Anda
      const response = await fetch('YOUR_GOOGLE_APPS_SCRIPT_URL', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('Data sent to Google Sheets');
    } catch (error) {
      console.error('Failed to send data:', error);
    }
  };

  const handleCloseTimer = () => {
    setShowTimer(false);
    // Resume tracking
    const postElements = document.querySelectorAll('[data-post-id]');
    postElements.forEach((el) => {
      const postId = el.getAttribute('data-post-id');
      if (postId && !postStartTimeRef.current.has(postId)) {
        // Check if currently visible
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          postStartTimeRef.current.set(postId, Date.now());
        }
      }
    });
  };

  return (
    <div className="feed-container">
      <div className="posts-list">
        {posts.map((post) => (
          <div
            key={post.id}
            data-post-id={post.id}
            data-genre={post.genre}
            className="post-wrapper"
          >
            <FeedCard post={post} />
          </div>
        ))}
      </div>

      {/* Timer Button */}
      <button
        onClick={handleOpenTimer}
        className="timer-button"
        aria-label="Open timer overlay"
      >
        ⏱️ {Math.floor(Object.values(genreTimes).reduce((a, b) => a + b, 0) / 1000)}s
      </button>

      {/* Timer Overlay */}
      {showTimer && (
        <TimerOverlay
          genreTimes={genreTimes}
          onClose={handleCloseTimer}
          sessionId={sessionIdRef.current}
        />
      )}
    </div>
  );
}
````

Now create the **TimerOverlay component** yang menampilkan breakdown per genre:

````typescript
// filepath: d:\GRACE\Projects\iNeedSocial_withoutLatency\components\timer\TimerOverlay.tsx
'use client';

import { useEffect, useState } from 'react';
import './TimerOverlay.css';

interface TimerOverlayProps {
  genreTimes: {
    humor: number;
    berita: number;
    wisata: number;
    makanan: number;
    olahraga: number;
    game: number;
  };
  onClose: () => void;
  sessionId: string;
}

export default function TimerOverlay({ genreTimes, onClose, sessionId }: TimerOverlayProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const genres = [
    { key: 'humor', label: '😂 Humor', color: '#FF6B6B' },
    { key: 'berita', label: '📰 Berita', color: '#4ECDC4' },
    { key: 'wisata', label: '✈️ Wisata', color: '#45B7D1' },
    { key: 'makanan', label: '🍔 Makanan', color: '#FFA07A' },
    { key: 'olahraga', label: '⚽ Olahraga', color: '#98D8C8' },
    { key: 'game', label: '🎮 Game', color: '#F7DC6F' },
  ];

  const totalTime = Object.values(genreTimes).reduce((a, b) => a + b, 0);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const getPercentage = (time: number) => {
    return totalTime > 0 ? ((time / totalTime) * 100).toFixed(1) : '0';
  };

  const downloadReport = () => {
    setIsDownloading(true);

    // Create CSV data
    const csvContent = [
      ['Genre', 'Time (ms)', 'Time (formatted)', 'Percentage'],
      ...genres.map((g) => [
        g.label,
        genreTimes[g.key as keyof typeof genreTimes],
        formatTime(genreTimes[g.key as keyof typeof genreTimes]),
        `${getPercentage(genreTimes[g.key as keyof typeof genreTimes])}%`,
      ]),
      [],
      ['Total Time', totalTime, formatTime(totalTime), '100%'],
      ['Session ID', sessionId],
      ['Timestamp', new Date().toISOString()],
    ];

    const csv = csvContent.map((row) => row.join(',')).join('\n');

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `report_${sessionId}.csv`);
    link.style.visibility = 'hidden';
    document
```


## License: unknown
https://github.com/HausDAO/daohaus-app/blob/c50207b6bea7f9e429df7e25b9355481dc6f5990/src/utils/csv.js

```
Perfect! Now let's add **time-tracking logic** to your feed page using IntersectionObserver. This will track how long each post is visible and categorize by genre.

````typescript
// filepath: d:\GRACE\Projects\iNeedSocial_withoutLatency\app\pages\feed-page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import FeedCard from '@/components/feed/FeedCard';
import TimerOverlay from '@/components/timer/TimerOverlay';
import { fetchFeed } from '@/lib/api';

interface Post {
  id: string;
  type: string;
  genre: string;
  username: string;
  likes: string;
  caption: string;
  media: Array<{ src: string; alt: string }>;
}

interface GenreTime {
  humor: number;
  berita: number;
  wisata: number;
  makanan: number;
  olahraga: number;
  game: number;
}

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [showTimer, setShowTimer] = useState(false);
  const [genreTimes, setGenreTimes] = useState<GenreTime>({
    humor: 0,
    berita: 0,
    wisata: 0,
    makanan: 0,
    olahraga: 0,
    game: 0,
  });

  const sessionIdRef = useRef<string>('');
  const postTimersRef = useRef<Map<string, number>>(new Map());
  const postStartTimeRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    // Generate session ID
    sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Fetch feed data
    const loadFeed = async () => {
      const data = await fetchFeed();
      setPosts(data.posts);
    };
    loadFeed();
  }, []);

  useEffect(() => {
    // IntersectionObserver untuk tracking waktu post
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5, // Post dianggap visible jika 50% terlihat
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const postId = entry.target.getAttribute('data-post-id');
        const genre = entry.target.getAttribute('data-genre') as keyof GenreTime;

        if (!postId || !genre) return;

        if (entry.isIntersecting) {
          // Post mulai visible
          postStartTimeRef.current.set(postId, Date.now());
        } else {
          // Post tidak visible lagi, hitung waktunya
          const startTime = postStartTimeRef.current.get(postId);
          if (startTime) {
            const duration = Date.now() - startTime;
            const currentTime = postTimersRef.current.get(postId) || 0;
            postTimersRef.current.set(postId, currentTime + duration);

            // Update genre time
            setGenreTimes((prev) => ({
              ...prev,
              [genre]: prev[genre] + duration,
            }));

            postStartTimeRef.current.delete(postId);
          }
        }
      });
    }, observerOptions);

    // Observe semua post
    const postElements = document.querySelectorAll('[data-post-id]');
    postElements.forEach((el) => observer.observe(el));

    return () => {
      postElements.forEach((el) => observer.unobserve(el));
    };
  }, [posts]);

  // Handle saat user buka timer overlay
  const handleOpenTimer = async () => {
    // Stop tracking posts yang masih visible
    postStartTimeRef.current.forEach((startTime, postId) => {
      const duration = Date.now() - startTime;
      const genre = document.querySelector(`[data-post-id="${postId}"]`)?.getAttribute('data-genre') as keyof GenreTime;
      if (genre) {
        const currentTime = postTimersRef.current.get(postId) || 0;
        postTimersRef.current.set(postId, currentTime + duration);
        setGenreTimes((prev) => ({
          ...prev,
          [genre]: prev[genre] + duration,
        }));
      }
    });
    postStartTimeRef.current.clear();

    setShowTimer(true);

    // Send data to Google Sheets
    await sendDataToGoogleSheets();
  };

  const sendDataToGoogleSheets = async () => {
    const totalTime = Object.values(genreTimes).reduce((a, b) => a + b, 0);

    const payload = {
      timestamp: new Date().toISOString(),
      session_id: sessionIdRef.current,
      total_time: totalTime,
      humor_ms: genreTimes.humor,
      berita_ms: genreTimes.berita,
      wisata_ms: genreTimes.wisata,
      makanan_ms: genreTimes.makanan,
      olahraga_ms: genreTimes.olahraga,
      game_ms: genreTimes.game,
      app_version: 'without_latency', // ubah sesuai dengan versi app
    };

    try {
      // Ganti dengan Google Apps Script endpoint Anda
      const response = await fetch('YOUR_GOOGLE_APPS_SCRIPT_URL', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('Data sent to Google Sheets');
    } catch (error) {
      console.error('Failed to send data:', error);
    }
  };

  const handleCloseTimer = () => {
    setShowTimer(false);
    // Resume tracking
    const postElements = document.querySelectorAll('[data-post-id]');
    postElements.forEach((el) => {
      const postId = el.getAttribute('data-post-id');
      if (postId && !postStartTimeRef.current.has(postId)) {
        // Check if currently visible
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          postStartTimeRef.current.set(postId, Date.now());
        }
      }
    });
  };

  return (
    <div className="feed-container">
      <div className="posts-list">
        {posts.map((post) => (
          <div
            key={post.id}
            data-post-id={post.id}
            data-genre={post.genre}
            className="post-wrapper"
          >
            <FeedCard post={post} />
          </div>
        ))}
      </div>

      {/* Timer Button */}
      <button
        onClick={handleOpenTimer}
        className="timer-button"
        aria-label="Open timer overlay"
      >
        ⏱️ {Math.floor(Object.values(genreTimes).reduce((a, b) => a + b, 0) / 1000)}s
      </button>

      {/* Timer Overlay */}
      {showTimer && (
        <TimerOverlay
          genreTimes={genreTimes}
          onClose={handleCloseTimer}
          sessionId={sessionIdRef.current}
        />
      )}
    </div>
  );
}
````

Now create the **TimerOverlay component** yang menampilkan breakdown per genre:

````typescript
// filepath: d:\GRACE\Projects\iNeedSocial_withoutLatency\components\timer\TimerOverlay.tsx
'use client';

import { useEffect, useState } from 'react';
import './TimerOverlay.css';

interface TimerOverlayProps {
  genreTimes: {
    humor: number;
    berita: number;
    wisata: number;
    makanan: number;
    olahraga: number;
    game: number;
  };
  onClose: () => void;
  sessionId: string;
}

export default function TimerOverlay({ genreTimes, onClose, sessionId }: TimerOverlayProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const genres = [
    { key: 'humor', label: '😂 Humor', color: '#FF6B6B' },
    { key: 'berita', label: '📰 Berita', color: '#4ECDC4' },
    { key: 'wisata', label: '✈️ Wisata', color: '#45B7D1' },
    { key: 'makanan', label: '🍔 Makanan', color: '#FFA07A' },
    { key: 'olahraga', label: '⚽ Olahraga', color: '#98D8C8' },
    { key: 'game', label: '🎮 Game', color: '#F7DC6F' },
  ];

  const totalTime = Object.values(genreTimes).reduce((a, b) => a + b, 0);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const getPercentage = (time: number) => {
    return totalTime > 0 ? ((time / totalTime) * 100).toFixed(1) : '0';
  };

  const downloadReport = () => {
    setIsDownloading(true);

    // Create CSV data
    const csvContent = [
      ['Genre', 'Time (ms)', 'Time (formatted)', 'Percentage'],
      ...genres.map((g) => [
        g.label,
        genreTimes[g.key as keyof typeof genreTimes],
        formatTime(genreTimes[g.key as keyof typeof genreTimes]),
        `${getPercentage(genreTimes[g.key as keyof typeof genreTimes])}%`,
      ]),
      [],
      ['Total Time', totalTime, formatTime(totalTime), '100%'],
      ['Session ID', sessionId],
      ['Timestamp', new Date().toISOString()],
    ];

    const csv = csvContent.map((row) => row.join(',')).join('\n');

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `report_${sessionId}.csv`);
    link.style.visibility = 'hidden';
    document
```


## License: unknown
https://github.com/hamoudyazen/shopify_scraper/blob/67b36eec981b2218ac5946213b96dda0b9137bb0/src/app/product-page/product-page.component.ts

```
Perfect! Now let's add **time-tracking logic** to your feed page using IntersectionObserver. This will track how long each post is visible and categorize by genre.

````typescript
// filepath: d:\GRACE\Projects\iNeedSocial_withoutLatency\app\pages\feed-page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import FeedCard from '@/components/feed/FeedCard';
import TimerOverlay from '@/components/timer/TimerOverlay';
import { fetchFeed } from '@/lib/api';

interface Post {
  id: string;
  type: string;
  genre: string;
  username: string;
  likes: string;
  caption: string;
  media: Array<{ src: string; alt: string }>;
}

interface GenreTime {
  humor: number;
  berita: number;
  wisata: number;
  makanan: number;
  olahraga: number;
  game: number;
}

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [showTimer, setShowTimer] = useState(false);
  const [genreTimes, setGenreTimes] = useState<GenreTime>({
    humor: 0,
    berita: 0,
    wisata: 0,
    makanan: 0,
    olahraga: 0,
    game: 0,
  });

  const sessionIdRef = useRef<string>('');
  const postTimersRef = useRef<Map<string, number>>(new Map());
  const postStartTimeRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    // Generate session ID
    sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Fetch feed data
    const loadFeed = async () => {
      const data = await fetchFeed();
      setPosts(data.posts);
    };
    loadFeed();
  }, []);

  useEffect(() => {
    // IntersectionObserver untuk tracking waktu post
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5, // Post dianggap visible jika 50% terlihat
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const postId = entry.target.getAttribute('data-post-id');
        const genre = entry.target.getAttribute('data-genre') as keyof GenreTime;

        if (!postId || !genre) return;

        if (entry.isIntersecting) {
          // Post mulai visible
          postStartTimeRef.current.set(postId, Date.now());
        } else {
          // Post tidak visible lagi, hitung waktunya
          const startTime = postStartTimeRef.current.get(postId);
          if (startTime) {
            const duration = Date.now() - startTime;
            const currentTime = postTimersRef.current.get(postId) || 0;
            postTimersRef.current.set(postId, currentTime + duration);

            // Update genre time
            setGenreTimes((prev) => ({
              ...prev,
              [genre]: prev[genre] + duration,
            }));

            postStartTimeRef.current.delete(postId);
          }
        }
      });
    }, observerOptions);

    // Observe semua post
    const postElements = document.querySelectorAll('[data-post-id]');
    postElements.forEach((el) => observer.observe(el));

    return () => {
      postElements.forEach((el) => observer.unobserve(el));
    };
  }, [posts]);

  // Handle saat user buka timer overlay
  const handleOpenTimer = async () => {
    // Stop tracking posts yang masih visible
    postStartTimeRef.current.forEach((startTime, postId) => {
      const duration = Date.now() - startTime;
      const genre = document.querySelector(`[data-post-id="${postId}"]`)?.getAttribute('data-genre') as keyof GenreTime;
      if (genre) {
        const currentTime = postTimersRef.current.get(postId) || 0;
        postTimersRef.current.set(postId, currentTime + duration);
        setGenreTimes((prev) => ({
          ...prev,
          [genre]: prev[genre] + duration,
        }));
      }
    });
    postStartTimeRef.current.clear();

    setShowTimer(true);

    // Send data to Google Sheets
    await sendDataToGoogleSheets();
  };

  const sendDataToGoogleSheets = async () => {
    const totalTime = Object.values(genreTimes).reduce((a, b) => a + b, 0);

    const payload = {
      timestamp: new Date().toISOString(),
      session_id: sessionIdRef.current,
      total_time: totalTime,
      humor_ms: genreTimes.humor,
      berita_ms: genreTimes.berita,
      wisata_ms: genreTimes.wisata,
      makanan_ms: genreTimes.makanan,
      olahraga_ms: genreTimes.olahraga,
      game_ms: genreTimes.game,
      app_version: 'without_latency', // ubah sesuai dengan versi app
    };

    try {
      // Ganti dengan Google Apps Script endpoint Anda
      const response = await fetch('YOUR_GOOGLE_APPS_SCRIPT_URL', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('Data sent to Google Sheets');
    } catch (error) {
      console.error('Failed to send data:', error);
    }
  };

  const handleCloseTimer = () => {
    setShowTimer(false);
    // Resume tracking
    const postElements = document.querySelectorAll('[data-post-id]');
    postElements.forEach((el) => {
      const postId = el.getAttribute('data-post-id');
      if (postId && !postStartTimeRef.current.has(postId)) {
        // Check if currently visible
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          postStartTimeRef.current.set(postId, Date.now());
        }
      }
    });
  };

  return (
    <div className="feed-container">
      <div className="posts-list">
        {posts.map((post) => (
          <div
            key={post.id}
            data-post-id={post.id}
            data-genre={post.genre}
            className="post-wrapper"
          >
            <FeedCard post={post} />
          </div>
        ))}
      </div>

      {/* Timer Button */}
      <button
        onClick={handleOpenTimer}
        className="timer-button"
        aria-label="Open timer overlay"
      >
        ⏱️ {Math.floor(Object.values(genreTimes).reduce((a, b) => a + b, 0) / 1000)}s
      </button>

      {/* Timer Overlay */}
      {showTimer && (
        <TimerOverlay
          genreTimes={genreTimes}
          onClose={handleCloseTimer}
          sessionId={sessionIdRef.current}
        />
      )}
    </div>
  );
}
````

Now create the **TimerOverlay component** yang menampilkan breakdown per genre:

````typescript
// filepath: d:\GRACE\Projects\iNeedSocial_withoutLatency\components\timer\TimerOverlay.tsx
'use client';

import { useEffect, useState } from 'react';
import './TimerOverlay.css';

interface TimerOverlayProps {
  genreTimes: {
    humor: number;
    berita: number;
    wisata: number;
    makanan: number;
    olahraga: number;
    game: number;
  };
  onClose: () => void;
  sessionId: string;
}

export default function TimerOverlay({ genreTimes, onClose, sessionId }: TimerOverlayProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const genres = [
    { key: 'humor', label: '😂 Humor', color: '#FF6B6B' },
    { key: 'berita', label: '📰 Berita', color: '#4ECDC4' },
    { key: 'wisata', label: '✈️ Wisata', color: '#45B7D1' },
    { key: 'makanan', label: '🍔 Makanan', color: '#FFA07A' },
    { key: 'olahraga', label: '⚽ Olahraga', color: '#98D8C8' },
    { key: 'game', label: '🎮 Game', color: '#F7DC6F' },
  ];

  const totalTime = Object.values(genreTimes).reduce((a, b) => a + b, 0);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const getPercentage = (time: number) => {
    return totalTime > 0 ? ((time / totalTime) * 100).toFixed(1) : '0';
  };

  const downloadReport = () => {
    setIsDownloading(true);

    // Create CSV data
    const csvContent = [
      ['Genre', 'Time (ms)', 'Time (formatted)', 'Percentage'],
      ...genres.map((g) => [
        g.label,
        genreTimes[g.key as keyof typeof genreTimes],
        formatTime(genreTimes[g.key as keyof typeof genreTimes]),
        `${getPercentage(genreTimes[g.key as keyof typeof genreTimes])}%`,
      ]),
      [],
      ['Total Time', totalTime, formatTime(totalTime), '100%'],
      ['Session ID', sessionId],
      ['Timestamp', new Date().toISOString()],
    ];

    const csv = csvContent.map((row) => row.join(',')).join('\n');

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `report_${sessionId}.csv`);
    link.style.visibility = 'hidden';
    document
```


## License: unknown
https://github.com/retrojorgen/kode24-newcss/blob/173278f6552874453df4f347716c69e128246b4c/examples/index-mobile.html

```
Perfect! Now let's add **time-tracking logic** to your feed page using IntersectionObserver. This will track how long each post is visible and categorize by genre.

````typescript
// filepath: d:\GRACE\Projects\iNeedSocial_withoutLatency\app\pages\feed-page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import FeedCard from '@/components/feed/FeedCard';
import TimerOverlay from '@/components/timer/TimerOverlay';
import { fetchFeed } from '@/lib/api';

interface Post {
  id: string;
  type: string;
  genre: string;
  username: string;
  likes: string;
  caption: string;
  media: Array<{ src: string; alt: string }>;
}

interface GenreTime {
  humor: number;
  berita: number;
  wisata: number;
  makanan: number;
  olahraga: number;
  game: number;
}

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [showTimer, setShowTimer] = useState(false);
  const [genreTimes, setGenreTimes] = useState<GenreTime>({
    humor: 0,
    berita: 0,
    wisata: 0,
    makanan: 0,
    olahraga: 0,
    game: 0,
  });

  const sessionIdRef = useRef<string>('');
  const postTimersRef = useRef<Map<string, number>>(new Map());
  const postStartTimeRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    // Generate session ID
    sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Fetch feed data
    const loadFeed = async () => {
      const data = await fetchFeed();
      setPosts(data.posts);
    };
    loadFeed();
  }, []);

  useEffect(() => {
    // IntersectionObserver untuk tracking waktu post
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5, // Post dianggap visible jika 50% terlihat
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const postId = entry.target.getAttribute('data-post-id');
        const genre = entry.target.getAttribute('data-genre') as keyof GenreTime;

        if (!postId || !genre) return;

        if (entry.isIntersecting) {
          // Post mulai visible
          postStartTimeRef.current.set(postId, Date.now());
        } else {
          // Post tidak visible lagi, hitung waktunya
          const startTime = postStartTimeRef.current.get(postId);
          if (startTime) {
            const duration = Date.now() - startTime;
            const currentTime = postTimersRef.current.get(postId) || 0;
            postTimersRef.current.set(postId, currentTime + duration);

            // Update genre time
            setGenreTimes((prev) => ({
              ...prev,
              [genre]: prev[genre] + duration,
            }));

            postStartTimeRef.current.delete(postId);
          }
        }
      });
    }, observerOptions);

    // Observe semua post
    const postElements = document.querySelectorAll('[data-post-id]');
    postElements.forEach((el) => observer.observe(el));

    return () => {
      postElements.forEach((el) => observer.unobserve(el));
    };
  }, [posts]);

  // Handle saat user buka timer overlay
  const handleOpenTimer = async () => {
    // Stop tracking posts yang masih visible
    postStartTimeRef.current.forEach((startTime, postId) => {
      const duration = Date.now() - startTime;
      const genre = document.querySelector(`[data-post-id="${postId}"]`)?.getAttribute('data-genre') as keyof GenreTime;
      if (genre) {
        const currentTime = postTimersRef.current.get(postId) || 0;
        postTimersRef.current.set(postId, currentTime + duration);
        setGenreTimes((prev) => ({
          ...prev,
          [genre]: prev[genre] + duration,
        }));
      }
    });
    postStartTimeRef.current.clear();

    setShowTimer(true);

    // Send data to Google Sheets
    await sendDataToGoogleSheets();
  };

  const sendDataToGoogleSheets = async () => {
    const totalTime = Object.values(genreTimes).reduce((a, b) => a + b, 0);

    const payload = {
      timestamp: new Date().toISOString(),
      session_id: sessionIdRef.current,
      total_time: totalTime,
      humor_ms: genreTimes.humor,
      berita_ms: genreTimes.berita,
      wisata_ms: genreTimes.wisata,
      makanan_ms: genreTimes.makanan,
      olahraga_ms: genreTimes.olahraga,
      game_ms: genreTimes.game,
      app_version: 'without_latency', // ubah sesuai dengan versi app
    };

    try {
      // Ganti dengan Google Apps Script endpoint Anda
      const response = await fetch('YOUR_GOOGLE_APPS_SCRIPT_URL', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('Data sent to Google Sheets');
    } catch (error) {
      console.error('Failed to send data:', error);
    }
  };

  const handleCloseTimer = () => {
    setShowTimer(false);
    // Resume tracking
    const postElements = document.querySelectorAll('[data-post-id]');
    postElements.forEach((el) => {
      const postId = el.getAttribute('data-post-id');
      if (postId && !postStartTimeRef.current.has(postId)) {
        // Check if currently visible
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          postStartTimeRef.current.set(postId, Date.now());
        }
      }
    });
  };

  return (
    <div className="feed-container">
      <div className="posts-list">
        {posts.map((post) => (
          <div
            key={post.id}
            data-post-id={post.id}
            data-genre={post.genre}
            className="post-wrapper"
          >
            <FeedCard post={post} />
          </div>
        ))}
      </div>

      {/* Timer Button */}
      <button
        onClick={handleOpenTimer}
        className="timer-button"
        aria-label="Open timer overlay"
      >
        ⏱️ {Math.floor(Object.values(genreTimes).reduce((a, b) => a + b, 0) / 1000)}s
      </button>

      {/* Timer Overlay */}
      {showTimer && (
        <TimerOverlay
          genreTimes={genreTimes}
          onClose={handleCloseTimer}
          sessionId={sessionIdRef.current}
        />
      )}
    </div>
  );
}
````

Now create the **TimerOverlay component** yang menampilkan breakdown per genre:

````typescript
// filepath: d:\GRACE\Projects\iNeedSocial_withoutLatency\components\timer\TimerOverlay.tsx
'use client';

import { useEffect, useState } from 'react';
import './TimerOverlay.css';

interface TimerOverlayProps {
  genreTimes: {
    humor: number;
    berita: number;
    wisata: number;
    makanan: number;
    olahraga: number;
    game: number;
  };
  onClose: () => void;
  sessionId: string;
}

export default function TimerOverlay({ genreTimes, onClose, sessionId }: TimerOverlayProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const genres = [
    { key: 'humor', label: '😂 Humor', color: '#FF6B6B' },
    { key: 'berita', label: '📰 Berita', color: '#4ECDC4' },
    { key: 'wisata', label: '✈️ Wisata', color: '#45B7D1' },
    { key: 'makanan', label: '🍔 Makanan', color: '#FFA07A' },
    { key: 'olahraga', label: '⚽ Olahraga', color: '#98D8C8' },
    { key: 'game', label: '🎮 Game', color: '#F7DC6F' },
  ];

  const totalTime = Object.values(genreTimes).reduce((a, b) => a + b, 0);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const getPercentage = (time: number) => {
    return totalTime > 0 ? ((time / totalTime) * 100).toFixed(1) : '0';
  };

  const downloadReport = () => {
    setIsDownloading(true);

    // Create CSV data
    const csvContent = [
      ['Genre', 'Time (ms)', 'Time (formatted)', 'Percentage'],
      ...genres.map((g) => [
        g.label,
        genreTimes[g.key as keyof typeof genreTimes],
        formatTime(genreTimes[g.key as keyof typeof genreTimes]),
        `${getPercentage(genreTimes[g.key as keyof typeof genreTimes])}%`,
      ]),
      [],
      ['Total Time', totalTime, formatTime(totalTime), '100%'],
      ['Session ID', sessionId],
      ['Timestamp', new Date().toISOString()],
    ];

    const csv = csvContent.map((row) => row.join(',')).join('\n');

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `report_${sessionId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setIsDownloading(false);
  };

  return (
    <div className="timer-overlay-backdrop" onClick={onClose}>
      <div className="timer-overlay-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>✕</button>

        <h2>📊 Your Content Report</h2>
        <p className="session-id">Session: {sessionId}</p>

        {/* Genre Breakdown */}
        <div className="genre-breakdown">
          {genres.map((genre) => {
            const time = genreTimes[genre.key as keyof typeof genreTimes];
            const percentage = getPercentage(time);

            return (
              <div key={genre.key} className="genre-item">
                <div className="genre-header">
                  <span className="genre-label">{genre.label}</span>
                  <span className="genre-time">{formatTime(time)}</span>
                </div>
                <div className="genre-bar-container">
                  <div
                    className="genre-bar"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: genre.color,
                    }}
                  />
                </div>
                <span className="genre-percentage">{percentage}%</span>
              </div>
            );
          })}
        </div>

        {/* Total Time */}
        <div className="total-time">
          <strong>Total Time:</strong>
          <span>{formatTime(totalTime)}</span>
        </div>

        {/* Download Button */}
        <button
          className="download-button"
          onClick={downloadReport}
          disabled={isDownloading}
        >
          {isDownloading ? '⏳ Downloading...' : '⬇️ Download Report'}
        </button>

        <p className="note">Your data is automatically synced to the lecturer's dashboard</p>
      </div>
    </div>
  );
}
````

Styling untuk TimerOverlay:

````css
/* filepath: d:\GRACE\Projects\iNeedSocial_withoutLatency\components\timer\TimerOverlay.css */

.timer-overlay-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.timer-overlay-content {
  background: white;
  border-radius: 16px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y
```


## License: unknown
https://github.com/retrojorgen/kode24-newcss/blob/173278f6552874453df4f347716c69e128246b4c/examples/index-mobile.html

```
Perfect! Now let's add **time-tracking logic** to your feed page using IntersectionObserver. This will track how long each post is visible and categorize by genre.

````typescript
// filepath: d:\GRACE\Projects\iNeedSocial_withoutLatency\app\pages\feed-page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import FeedCard from '@/components/feed/FeedCard';
import TimerOverlay from '@/components/timer/TimerOverlay';
import { fetchFeed } from '@/lib/api';

interface Post {
  id: string;
  type: string;
  genre: string;
  username: string;
  likes: string;
  caption: string;
  media: Array<{ src: string; alt: string }>;
}

interface GenreTime {
  humor: number;
  berita: number;
  wisata: number;
  makanan: number;
  olahraga: number;
  game: number;
}

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [showTimer, setShowTimer] = useState(false);
  const [genreTimes, setGenreTimes] = useState<GenreTime>({
    humor: 0,
    berita: 0,
    wisata: 0,
    makanan: 0,
    olahraga: 0,
    game: 0,
  });

  const sessionIdRef = useRef<string>('');
  const postTimersRef = useRef<Map<string, number>>(new Map());
  const postStartTimeRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    // Generate session ID
    sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Fetch feed data
    const loadFeed = async () => {
      const data = await fetchFeed();
      setPosts(data.posts);
    };
    loadFeed();
  }, []);

  useEffect(() => {
    // IntersectionObserver untuk tracking waktu post
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5, // Post dianggap visible jika 50% terlihat
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const postId = entry.target.getAttribute('data-post-id');
        const genre = entry.target.getAttribute('data-genre') as keyof GenreTime;

        if (!postId || !genre) return;

        if (entry.isIntersecting) {
          // Post mulai visible
          postStartTimeRef.current.set(postId, Date.now());
        } else {
          // Post tidak visible lagi, hitung waktunya
          const startTime = postStartTimeRef.current.get(postId);
          if (startTime) {
            const duration = Date.now() - startTime;
            const currentTime = postTimersRef.current.get(postId) || 0;
            postTimersRef.current.set(postId, currentTime + duration);

            // Update genre time
            setGenreTimes((prev) => ({
              ...prev,
              [genre]: prev[genre] + duration,
            }));

            postStartTimeRef.current.delete(postId);
          }
        }
      });
    }, observerOptions);

    // Observe semua post
    const postElements = document.querySelectorAll('[data-post-id]');
    postElements.forEach((el) => observer.observe(el));

    return () => {
      postElements.forEach((el) => observer.unobserve(el));
    };
  }, [posts]);

  // Handle saat user buka timer overlay
  const handleOpenTimer = async () => {
    // Stop tracking posts yang masih visible
    postStartTimeRef.current.forEach((startTime, postId) => {
      const duration = Date.now() - startTime;
      const genre = document.querySelector(`[data-post-id="${postId}"]`)?.getAttribute('data-genre') as keyof GenreTime;
      if (genre) {
        const currentTime = postTimersRef.current.get(postId) || 0;
        postTimersRef.current.set(postId, currentTime + duration);
        setGenreTimes((prev) => ({
          ...prev,
          [genre]: prev[genre] + duration,
        }));
      }
    });
    postStartTimeRef.current.clear();

    setShowTimer(true);

    // Send data to Google Sheets
    await sendDataToGoogleSheets();
  };

  const sendDataToGoogleSheets = async () => {
    const totalTime = Object.values(genreTimes).reduce((a, b) => a + b, 0);

    const payload = {
      timestamp: new Date().toISOString(),
      session_id: sessionIdRef.current,
      total_time: totalTime,
      humor_ms: genreTimes.humor,
      berita_ms: genreTimes.berita,
      wisata_ms: genreTimes.wisata,
      makanan_ms: genreTimes.makanan,
      olahraga_ms: genreTimes.olahraga,
      game_ms: genreTimes.game,
      app_version: 'without_latency', // ubah sesuai dengan versi app
    };

    try {
      // Ganti dengan Google Apps Script endpoint Anda
      const response = await fetch('YOUR_GOOGLE_APPS_SCRIPT_URL', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('Data sent to Google Sheets');
    } catch (error) {
      console.error('Failed to send data:', error);
    }
  };

  const handleCloseTimer = () => {
    setShowTimer(false);
    // Resume tracking
    const postElements = document.querySelectorAll('[data-post-id]');
    postElements.forEach((el) => {
      const postId = el.getAttribute('data-post-id');
      if (postId && !postStartTimeRef.current.has(postId)) {
        // Check if currently visible
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          postStartTimeRef.current.set(postId, Date.now());
        }
      }
    });
  };

  return (
    <div className="feed-container">
      <div className="posts-list">
        {posts.map((post) => (
          <div
            key={post.id}
            data-post-id={post.id}
            data-genre={post.genre}
            className="post-wrapper"
          >
            <FeedCard post={post} />
          </div>
        ))}
      </div>

      {/* Timer Button */}
      <button
        onClick={handleOpenTimer}
        className="timer-button"
        aria-label="Open timer overlay"
      >
        ⏱️ {Math.floor(Object.values(genreTimes).reduce((a, b) => a + b, 0) / 1000)}s
      </button>

      {/* Timer Overlay */}
      {showTimer && (
        <TimerOverlay
          genreTimes={genreTimes}
          onClose={handleCloseTimer}
          sessionId={sessionIdRef.current}
        />
      )}
    </div>
  );
}
````

Now create the **TimerOverlay component** yang menampilkan breakdown per genre:

````typescript
// filepath: d:\GRACE\Projects\iNeedSocial_withoutLatency\components\timer\TimerOverlay.tsx
'use client';

import { useEffect, useState } from 'react';
import './TimerOverlay.css';

interface TimerOverlayProps {
  genreTimes: {
    humor: number;
    berita: number;
    wisata: number;
    makanan: number;
    olahraga: number;
    game: number;
  };
  onClose: () => void;
  sessionId: string;
}

export default function TimerOverlay({ genreTimes, onClose, sessionId }: TimerOverlayProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const genres = [
    { key: 'humor', label: '😂 Humor', color: '#FF6B6B' },
    { key: 'berita', label: '📰 Berita', color: '#4ECDC4' },
    { key: 'wisata', label: '✈️ Wisata', color: '#45B7D1' },
    { key: 'makanan', label: '🍔 Makanan', color: '#FFA07A' },
    { key: 'olahraga', label: '⚽ Olahraga', color: '#98D8C8' },
    { key: 'game', label: '🎮 Game', color: '#F7DC6F' },
  ];

  const totalTime = Object.values(genreTimes).reduce((a, b) => a + b, 0);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const getPercentage = (time: number) => {
    return totalTime > 0 ? ((time / totalTime) * 100).toFixed(1) : '0';
  };

  const downloadReport = () => {
    setIsDownloading(true);

    // Create CSV data
    const csvContent = [
      ['Genre', 'Time (ms)', 'Time (formatted)', 'Percentage'],
      ...genres.map((g) => [
        g.label,
        genreTimes[g.key as keyof typeof genreTimes],
        formatTime(genreTimes[g.key as keyof typeof genreTimes]),
        `${getPercentage(genreTimes[g.key as keyof typeof genreTimes])}%`,
      ]),
      [],
      ['Total Time', totalTime, formatTime(totalTime), '100%'],
      ['Session ID', sessionId],
      ['Timestamp', new Date().toISOString()],
    ];

    const csv = csvContent.map((row) => row.join(',')).join('\n');

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `report_${sessionId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setIsDownloading(false);
  };

  return (
    <div className="timer-overlay-backdrop" onClick={onClose}>
      <div className="timer-overlay-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>✕</button>

        <h2>📊 Your Content Report</h2>
        <p className="session-id">Session: {sessionId}</p>

        {/* Genre Breakdown */}
        <div className="genre-breakdown">
          {genres.map((genre) => {
            const time = genreTimes[genre.key as keyof typeof genreTimes];
            const percentage = getPercentage(time);

            return (
              <div key={genre.key} className="genre-item">
                <div className="genre-header">
                  <span className="genre-label">{genre.label}</span>
                  <span className="genre-time">{formatTime(time)}</span>
                </div>
                <div className="genre-bar-container">
                  <div
                    className="genre-bar"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: genre.color,
                    }}
                  />
                </div>
                <span className="genre-percentage">{percentage}%</span>
              </div>
            );
          })}
        </div>

        {/* Total Time */}
        <div className="total-time">
          <strong>Total Time:</strong>
          <span>{formatTime(totalTime)}</span>
        </div>

        {/* Download Button */}
        <button
          className="download-button"
          onClick={downloadReport}
          disabled={isDownloading}
        >
          {isDownloading ? '⏳ Downloading...' : '⬇️ Download Report'}
        </button>

        <p className="note">Your data is automatically synced to the lecturer's dashboard</p>
      </div>
    </div>
  );
}
````

Styling untuk TimerOverlay:

````css
/* filepath: d:\GRACE\Projects\iNeedSocial_withoutLatency\components\timer\TimerOverlay.css */

.timer-overlay-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.timer-overlay-content {
  background: white;
  border-radius: 16px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y
```


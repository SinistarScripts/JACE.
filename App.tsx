
import React, { useEffect, useRef, useState } from 'react';
import { FEED_DATA } from './data';
import { VideoPost } from './types';

// Inline VideoCard component since separate file is missing
const VideoCard: React.FC<{ post: VideoPost; isActive: boolean }> = ({ post, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isActive) {
      videoRef.current?.play().catch(e => console.log('Autoplay blocked', e));
    } else {
      videoRef.current?.pause();
      if (videoRef.current) videoRef.current.currentTime = 0;
    }
  }, [isActive]);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      <video
        ref={videoRef}
        src={post.videoUrl}
        className="w-full h-full object-cover"
        loop
        muted
        playsInline
      />
      <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/80 to-transparent text-white">
        <h3 className="font-bold text-lg">@{post.user.username}</h3>
        <p className="text-sm opacity-90">{post.description}</p>
        <div className="flex items-center gap-4 mt-2">
            <span className="text-xs font-bold">❤️ {post.likes}</span>
            <span className="text-xs font-bold">💬 {post.comments}</span>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeVideoId, setActiveVideoId] = useState<string>(FEED_DATA[0].id);

  // Intersection Observer to detect which video is currently in view
  useEffect(() => {
    const options = {
      root: containerRef.current,
      threshold: 0.6, // Video must be 60% visible to be considered "active"
    };

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const videoId = entry.target.getAttribute('data-id');
          if (videoId) {
            setActiveVideoId(videoId);
          }
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersection, options);

    const container = containerRef.current;
    if (container) {
      // Observe all child elements (video cards)
      Array.from(container.children).forEach((child) => {
        observer.observe(child);
      });
    }

    return () => {
      if (container) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        Array.from(container.children).forEach((child) => {
          observer.unobserve(child);
        });
      }
    };
  }, []);

  return (
    <div className="w-full h-screen bg-black flex justify-center items-center">
      <div 
        ref={containerRef}
        className="w-full max-w-[480px] h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar bg-gray-900 relative shadow-2xl"
      >
        {FEED_DATA.map((post) => (
          <div 
            key={post.id} 
            data-id={post.id}
            className="w-full h-full snap-start snap-always"
          >
            <VideoCard 
              post={post} 
              isActive={activeVideoId === post.id} 
            />
          </div>
        ))}
        
        {/* Desktop Navigation Hints (Optional visual aid) */}
        <div className="hidden lg:block fixed right-8 top-1/2 -translate-y-1/2 space-y-4">
             <div className="bg-gray-800/50 p-4 rounded-xl backdrop-blur-sm border border-gray-700 text-gray-400 text-sm">
                <p className="mb-2">Use <kbd className="bg-gray-700 px-2 py-0.5 rounded text-white">↑</kbd> <kbd className="bg-gray-700 px-2 py-0.5 rounded text-white">↓</kbd> keys</p>
                <p>or scroll to navigate</p>
             </div>
        </div>
      </div>
    </div>
  );
};

export default App;

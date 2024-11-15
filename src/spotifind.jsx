import React, { useState, useEffect } from 'react';
import axios from 'axios';
import audioFeaturesData from './data.js';

// Authentication constants for Spotify API
const CLIENT_ID = "87d96cbf1c324497bf26051e7f9a5fd1";
const REDIRECT_URI = encodeURIComponent("https://spot1.d35x29ay3m6g9f.amplifyapp.com/callback");
const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const RESPONSE_TYPE = "token";
const SCOPE = encodeURIComponent("user-top-read user-read-private user-read-email");

// Define the order of audio features for consistent processing
const ORDERED_FEATURES = [
  'duration_ms',
  'danceability',
  'energy',
  'key',
  'loudness',
  'mode',
  'speechiness',
  'acousticness',
  'instrumentalness',
  'liveness',
  'valence',
  'tempo',
  'time_signature'
];

const SpotifyAuthApp = () => {
  // State management for both users
  const [user1Token, setUser1Token] = useState("");
  const [user2Token, setUser2Token] = useState("");
  const [user1Tracks, setUser1Tracks] = useState([]);
  const [user2Tracks, setUser2Tracks] = useState([]);
  const [user1Error, setUser1Error] = useState("");
  const [user2Error, setUser2Error] = useState("");
  const [isUser1Loading, setIsUser1Loading] = useState(false);
  const [isUser2Loading, setIsUser2Loading] = useState(false);
  const [similarityScore, setSimilarityScore] = useState(null);
  const [recommendedTracks, setRecommendedTracks] = useState([]);
  const [audioFeatures, setAudioFeatures] = useState(audioFeaturesData);
  const [user1Name, setUser1Name] = useState("");
  const [user2Name, setUser2Name] = useState("");

  // Fetch user profile from Spotify API
  const getUserProfile = async (token, userNumber) => {
    try {
      const response = await fetch("https://api.spotify.com/v1/me", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch user profile');
      
      const data = await response.json();
      const displayName = data.display_name || data.id;
      
      if (userNumber === 'user1') {
        setUser1Name(displayName);
        window.localStorage.setItem('user1Name', displayName);
      } else {
        setUser2Name(displayName);
        window.localStorage.setItem('user2Name', displayName);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  // Handle authentication flow and token management
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const token = hashParams.get("access_token");
      const state = hashParams.get("state");
      
      if (token) {
        if (state === "user1") {
          window.localStorage.setItem("user1Token", token);
          setUser1Token(token);
          getUserProfile(token, 'user1');
        } else if (state === "user2") {
          window.localStorage.setItem("user2Token", token);     
          setUser2Token(token);
          getUserProfile(token, 'user2');
        }
        window.history.pushState("", document.title, window.location.pathname);
      }
    }

    // Load stored tokens and usernames from localStorage
    const storedUser1Token = window.localStorage.getItem("user1Token");
    const storedUser2Token = window.localStorage.getItem("user2Token");
    const storedUser1Name = window.localStorage.getItem("user1Name");
    const storedUser2Name = window.localStorage.getItem("user2Name");
    
    if (storedUser1Token) {
      setUser1Token(storedUser1Token);
      if (storedUser1Name) setUser1Name(storedUser1Name);
      else getUserProfile(storedUser1Token, 'user1');
    }
    if (storedUser2Token) {
      setUser2Token(storedUser2Token);
      if (storedUser2Name) setUser2Name(storedUser2Name);
      else getUserProfile(storedUser2Token, 'user2');
    }
  }, []);
  
  // Fetch audio features for a specific track
  const getAudioFeatures = async (trackId, token) => {
    try {
      const response = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch audio features');
      
      const data = await response.json();
      
      // Create ordered features object
      const orderedFeatures = {};
      ORDERED_FEATURES.forEach(feature => {
        orderedFeatures[feature] = data[feature];
      });
      
      return orderedFeatures;
    } catch (error) {
      console.error('Error fetching audio features:', error);
      return null;
    }
  };

  // Fetch top tracks for a user
  const getTopTracks = async (userNumber) => {
    const token = userNumber === 'user1' ? user1Token : user2Token;
    const setLoading = userNumber === 'user1' ? setIsUser1Loading : setIsUser2Loading;
    const setError = userNumber === 'user1' ? setUser1Error : setUser2Error;
    const setTracks = userNumber === 'user1' ? setUser1Tracks : setUser2Tracks;

    if (!token) {
      setError("Please login first");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("https://api.spotify.com/v1/me/top/tracks?time_range=long_term&limit=5", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch top tracks');
      
      const data = await response.json();
      setTracks(data.items);

      // Fetch audio features for each track
      const tracksWithFeatures = await Promise.all(
        data.items.map(async (track) => {
          const features = await getAudioFeatures(track.id, token);
          return {
            id: track.id,
            name: track.name,
            artists: track.artists.map(artist => artist.name),
            features: features
          };
        })
      );

      // Update audio features data structure
      const updatedAudioFeatures = {
        ...audioFeatures,
        [userNumber]: {
          tracks: tracksWithFeatures
        }
      };

      setAudioFeatures(updatedAudioFeatures);
      localStorage.setItem('audioFeaturesData', JSON.stringify(updatedAudioFeatures));
      setError("");
    } catch (err) {
      setError("Failed to load tracks and features. Please try logging in again.");
      console.error(err);
      if (err.message.includes('401')) {
        logoutUser(userNumber);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle user logout
  const logoutUser = (userNumber) => {
    if (userNumber === 'user1') {
      setUser1Token("");
      setUser1Tracks([]);
      setUser1Name("");
      window.localStorage.removeItem("user1Token");
      window.localStorage.removeItem("user1Name");
      setAudioFeatures(prev => ({
        ...prev,
        user1: { tracks: [] }
      }));
    } else {
      setUser2Token("");
      setUser2Tracks([]);
      setUser2Name("");
      window.localStorage.removeItem("user2Token");
      window.localStorage.removeItem("user2Name");
      setAudioFeatures(prev => ({
        ...prev,
        user2: { tracks: [] }
      }));
    }
  };

  // Handle user login
  const loginUser = (userNumber) => {
    const authUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=${RESPONSE_TYPE}&scope=${SCOPE}&state=${userNumber}&show_dialog=true`;
    window.location.href = authUrl;
  };

  // Compare top tracks between users
  const compareTopTracks = async () => {
    try {
      const response = await axios.post('https://55cd-18-213-200-192.ngrok-free.app/compare-tracks', {
        user1Tracks,
        user2Tracks,
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });

      console.log(response);
      // const { similarityScore, recommendedTracks } = response.data;
      // setSimilarityScore(similarityScore);
      // setRecommendedTracks(recommendedTracks);
    } catch (error) {
      console.error('Error comparing tracks:', error);
    }
  };

  // Styles
  const containerStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  };

  const userContainerStyle = {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
  };

  const userSectionStyle = {
    flex: 1,
    minWidth: '300px',
  };

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    marginBottom: '20px',
  };

  const buttonStyle = {
    padding: '10px 20px',
    fontSize: '16px',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    backgroundColor: '#1DB954',
    color: 'white',
    transition: 'background-color 0.3s',
  };

  const errorStyle = {
    backgroundColor: '#FEE2E2',
    color: '#DC2626',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '20px',
  };

  const trackItemStyle = {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #eee',
    position: 'relative',
  };

  const numberStyle = {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#999',
    minWidth: '30px',
    marginRight: '15px',
  };

  const trackInfoStyle = {
    flex: 1,
    paddingRight: '60px',
  };

  const durationStyle = {
    position: 'absolute',
    right: '0',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '14px',
    color: '#666',
    fontFamily: 'monospace',
    fontWeight: 'bold'
  };

  // Format duration from milliseconds to MM:SS
  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };


  // Render common tracks between users
  const renderCommonTracks = () => {
    if (user1Tracks.length > 0 && user2Tracks.length > 0) {
      const commonTracks = user1Tracks.filter(track1 => 
        user2Tracks.some(track2 => track2.id === track1.id)
      );

      if (commonTracks.length > 0) {
        return (
          <div style={cardStyle}>
            <h2 style={{ color: '#333', marginBottom: '20px' }}>Common Tracks</h2>
            {commonTracks.map((track, index) => (
              <div key={track.id} style={trackItemStyle}>
                <span style={numberStyle}>{index + 1}</span>
                <div style={trackInfoStyle}>
                  <p style={{ margin: 0, fontWeight: 'bold', color: '#333' }}>
                    {track.name}
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                    {track.artists.map(artist => artist.name).join(', ')}
                  </p>
                </div>
                <span style={durationStyle}>
                  {formatDuration(track.duration_ms)}
                </span>
              </div>
            ))}
            <div style={{ marginTop: '20px' }}>
              <button 
                onClick={compareTopTracks}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  backgroundColor: '#1DB954',
                  marginTop: '20px'
                }}
              >
                Compare Top Tracks
              </button>
              {similarityScore !== null && (
                <div style={{ marginTop: '20px' }}>
                  <h3>Similarity Score: {similarityScore}</h3>
                  <h3>Recommended Tracks:</h3>
                  <ul style={{ padding: 0 }}>
                    {recommendedTracks.map((track, index) => (
                      <li key={index} style={trackItemStyle}>
                        <span style={numberStyle}>{index + 1}</span>
                        <div style={trackInfoStyle}>
                          <p style={{ margin: 0, fontWeight: 'bold', color: '#333' }}>
                            {track.name}
                          </p>
                          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                            {track.artists.map(artist => artist.name).join(', ')}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        );
      } 
      else{
        return(
        <div>

          <div style={{ marginTop: '20px' }}>
            <button 
              onClick={compareTopTracks}
              style={{
                ...buttonStyle,
                width: '100%',
                backgroundColor: '#1DB954',
                marginTop: '5px'
              }}
            >
              Compare Top Tracks
            </button>
            {similarityScore !== null && (
              <div style={{ marginTop: '20px' }}>
                <h3>Similarity Score: {similarityScore}</h3>
                <h3>Recommended Tracks:</h3>
                <ul style={{ padding: 0 }}>
                  {recommendedTracks.map((track, index) => (
                    <li key={index} style={trackItemStyle}>
                      <span style={numberStyle}>{index + 1}</span>
                      <div style={trackInfoStyle}>
                        <p style={{ margin: 0, fontWeight: 'bold', color: '#333' }}>
                          {track.name}
                        </p>
                        <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                          {track.artists.map(artist => artist.name).join(', ')}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            
          )}
          </div>
        </div>
      )
    }
    
    }
    return null;
  };

  // User Section Component
  const UserSection = ({ userNumber, token, tracks, error, isLoading }) => {
    // Get the appropriate username based on userNumber
    const username = userNumber === "user1" ? user1Name : user2Name;
    // If no username is available, show a generic placeholder
    const displayName = username || `Connect User ${userNumber.slice(-1)}`;
    
    return (
      <div style={userSectionStyle}>
        <h2 style={{ 
          color: '#333', 
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {displayName}
          {username && (
            <span style={{ 
              fontSize: '14px',
              backgroundColor: '#1DB954',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '12px',
              fontWeight: 'normal'
            }}>
              Connected
            </span>
          )}
        </h2>
        <div style={cardStyle}>
          {!token ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ marginBottom: '20px', color: '#666' }}>
                Connect with Spotify to see your most played tracks
              </p>
              <button
                style={buttonStyle}
                onMouseOver={e => e.target.style.backgroundColor = '#1ed760'}
                onMouseOut={e => e.target.style.backgroundColor = '#1DB954'}
                onClick={() => loginUser(userNumber)}
              >
                Login with Spotify
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <button
                  style={{ ...buttonStyle, width: '48%' }}
                  onMouseOver={e => e.target.style.backgroundColor = '#1ed760'}
                  onMouseOut={e => e.target.style.backgroundColor = '#1DB954'}
                  onClick={() => getTopTracks(userNumber)}
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Get Top Tracks'}
                </button>
                <button
                  style={{ ...buttonStyle, width: '48%', backgroundColor: '#333' }}
                  onMouseOver={e => e.target.style.backgroundColor = '#444'}
                  onMouseOut={e => e.target.style.backgroundColor = '#333'}
                  onClick={() => logoutUser(userNumber)}
                >
                  Logout
                </button>
              </div>

              {error && <div style={errorStyle}>{error}</div>}

              {tracks.length > 0 && (
                <div>
                  {tracks.map((track, index) => (
                    <div key={track.id} style={trackItemStyle}>
                      <span style={numberStyle}>{index + 1}</span>
                      <div style={trackInfoStyle}>
                        <p style={{ margin: 0, fontWeight: 'bold', color: '#333' }}>
                          {track.name}
                        </p>
                        <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                          {track.artists.map(artist => artist.name).join(', ')}
                        </p>
                      </div>
                      <span style={durationStyle}>
                        {formatDuration(track.duration_ms)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  // Main render
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '20px' }}>
      <div style={containerStyle}>
        <h1 className='header'>Spotifind</h1>
        <div style={userContainerStyle}>
          <UserSection
            userNumber="user1"
            token={user1Token}
            tracks={user1Tracks}
            error={user1Error}
            isLoading={isUser1Loading}
          />
          <UserSection
            userNumber="user2"
            token={user2Token}
            tracks={user2Tracks}
            error={user2Error}
            isLoading={isUser2Loading}
          />
        </div>
        {renderCommonTracks()}
      </div>
    </div>
  );
};

export default SpotifyAuthApp;

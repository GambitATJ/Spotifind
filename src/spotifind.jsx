import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CLIENT_ID = "87d96cbf1c324497bf26051e7f9a5fd1"; // Replace with your client ID
const REDIRECT_URI = encodeURIComponent("http://localhost:5174/callback");
const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const RESPONSE_TYPE = "token";
const SCOPE = encodeURIComponent("user-top-read user-read-private user-read-email");

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
  
  useEffect(() => {
    // Parse hash from URL
    const hash = window.location.hash;
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const token = hashParams.get("access_token");
      const state = hashParams.get("state");
      
      if (token) {
        // Store token based on state parameter
        if (state === "user1") {
          window.localStorage.setItem("user1Token", token);
          setUser1Token(token);
        } else if (state === "user2") {
          window.localStorage.setItem("user2Token", token);     
          setUser2Token(token);
        }
        // Clear the hash
        window.history.pushState("", document.title, window.location.pathname);
      }
    }

    // Load existing tokens from localStorage
    const storedUser1Token = window.localStorage.getItem("user1Token");
    const storedUser2Token = window.localStorage.getItem("user2Token");
    if (storedUser1Token) setUser1Token(storedUser1Token);
    if (storedUser2Token) setUser2Token(storedUser2Token);
  }, []);

  const loginUser = (userNumber) => {
    const authUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=${RESPONSE_TYPE}&scope=${SCOPE}&state=${userNumber}&show_dialog=true`;
    window.location.href = authUrl;
  };

  const logoutUser = (userNumber) => {
    if (userNumber === 'user1') {
      setUser1Token("");
      setUser1Tracks([]);
      window.localStorage.removeItem("user1Token");
    } else {
      setUser2Token("");
      setUser2Tracks([]);
      window.localStorage.removeItem("user2Token");
    }
  };

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
      setError("");
    } catch (err) {
      setError("Failed to load top tracks. Please try logging in again.");
      console.error(err);
      // Clear token if it's invalid
      if (err.message.includes('401')) {
        logoutUser(userNumber);
      }
    } finally {
      setLoading(false);
    }
  };


  const compareTopTracks = async () => {
    try {
      const response = await axios.post('https://colab.research.google.com/drive/1rsjeEYeMp3FzjFW_wBaESxP1eTifXFZt?usp=sharing/compare-tracks', {
        user1Tracks,
        user2Tracks,
      });

      const { similarityScore, recommendedTracks } = response.data;
      setSimilarityScore(similarityScore);
      setRecommendedTracks(recommendedTracks);
    } catch (error) {
      console.error('Error comparing tracks:', error);
    }
  };
  
  // Styles remain the same as before...
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
  };

  const UserSection = ({ userNumber, token, tracks, error, isLoading }) => (
    <div style={userSectionStyle}>
      <h2 style={{ color: '#333', marginBottom: '20px' }}>User {userNumber.slice(-1)}</h2>
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
              Login User {userNumber.slice(-1)}
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
                    <span style={{ 
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: '#999',
                      marginRight: '20px',
                      minWidth: '30px'
                    }}>
                      {index + 1}
                    </span>
                    <div>
                      <p style={{ 
                        margin: '0 0 5px 0',
                        fontWeight: 'bold',
                        color: '#333'
                      }}>
                        {track.name}
                      </p>
                      <p style={{ 
                        margin: 0,
                        fontSize: '14px',
                        color: '#666'
                      }}>
                        {track.artists.map(artist => artist.name).join(', ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '20px' }}>
      <div style={containerStyle}>
        <h1 className='header'>
          Spotifind
        </h1>
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

        {user1Tracks.length > 0 && user2Tracks.length > 0 && (
          <div style={cardStyle}>
            <div>
            <h2 style={{ color: '#333', marginBottom: '20px' }}>Common Tracks</h2>
            {user1Tracks
              .filter(track1 => 
                user2Tracks.some(track2 => track2.id === track1.id)
              )
              .map((track, index) => (
                <div key={track.id} style={trackItemStyle}>
                  <span style={{ 
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: '#999',
                    marginRight: '20px',
                    minWidth: '30px'
                  }}>
                    {index + 1}
                  </span>
                  <div>
                    <p style={{ 
                      margin: '0 0 5px 0',
                      fontWeight: 'bold',
                      color: '#333'
                    }}>
                      {track.name}
                    </p>
                    <p style={{ 
                      margin: 0,
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      {track.artists.map(artist => artist.name).join(', ')}
                    </p>
                  </div>
                </div>
              ))}
          </div>
          <div>
          <button onClick={compareTopTracks}>Compare Top Tracks</button>
    {similarityScore !== null && (
      <div>
        <h3>Similarity Score: {similarityScore}</h3>
        <h3>Recommended Tracks:</h3>
        <ul>
          {recommendedTracks.map((track, index) => (
            <li key={index}>
              {track.name} - {track.artists.map((artist) => artist.name).join(', ')}
            </li>
          ))}
        </ul>
      </div>
    )}
          </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpotifyAuthApp;
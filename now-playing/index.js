import OAuth from '../../lib/common/OAuth/OAuth.js'

const SPOTIFY_CLIENT_ID = '05985642776142019b153167794fec64'
const SPOTIFY_REDIRECT_URI = 'https://ootopi.duckdns.org/stream/now-playing/index.htm'
const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'
const SPOTIFY_AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize'

const search_params = new URLSearchParams(location.search)
const reset = search_params.get('reset')
if(reset) localStorage.clear()

const customizations = []
const song_color = search_params.get('song-color')
if(song_color) customizations.push(`--song-color: ${song_color}`)
const shadow_color = search_params.get('shadow-color')
if(shadow_color) customizations.push(`--shadow-color: ${shadow_color}`)
const artist_color = search_params.get('artist-color')
if(artist_color) customizations.push(`--artist-color: ${artist_color}`)
document.querySelector('.spotify_now-playing').style = customizations.join(';')

const oauth = new OAuth('spotify', {
    client_id: SPOTIFY_CLIENT_ID,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    authorization_endpoint: SPOTIFY_AUTH_ENDPOINT,
    token_endpoint: SPOTIFY_TOKEN_ENDPOINT,
    requested_scopes: 'user-read-playback-state user-read-currently-playing'
})

oauth.invalidate_access_token()

const dominant_color_canvas_context = document.createElement('canvas').getContext('2d')

function get_dominant_color(image) {
    dominant_color_canvas_context.drawImage(image, 0, 0, 1, 1)
    const i = dominant_color_canvas_context.getImageData(0, 0, 1, 1).data
    return `rgba(${i.join(',')})`
}

function currently_playing_track() {
    return oauth.request_access_token().then(token => 
        fetch('https://api.spotify.com/v1/me/player/currently-playing',{ 
            headers: {'Authorization': `Bearer ${token}`}
        })
    ).then(response => {
        if(response.status == 200) return response.json()
        if(response.status == 204) return
        oauth.invalidate_access_token()
    })
}

let transition_out = false
document.querySelector('.spotify_art img').addEventListener('load', () => {
    document.querySelector('.spotify_now-playing .vinyl').style = `--color: ${get_dominant_color(document.querySelector('.spotify_art img'))}`
})

function update_track(track_name = '', artists = [], album_art_url = '', is_playing = false) {
    artists = artists.map(artist => artist.name).join(', ')

    const spotify_artists_content = document.querySelector('.spotify_artists > .content_wrapper > .content')
    const spotify_song_content = document.querySelector('.spotify_song > .content_wrapper >  .content')

    const same_song = document.querySelector('.spotify_art img').src == album_art_url && spotify_artists_content.textContent == artists && spotify_song_content.textContent == track_name

    if(!same_song) {
        document.querySelector('.spotify_art img').src = album_art_url
        spotify_artists_content.textContent = artists
        spotify_song_content.textContent = track_name
        
        const artist_wrapper_width = parseFloat(getComputedStyle(document.querySelector('.spotify_artists')).width)
        const artist_content_width = spotify_artists_content.getBoundingClientRect().width
        const artist_scroll = artist_content_width >= artist_wrapper_width
        document.querySelector('.spotify_artists').classList.toggle('scroll', artist_scroll)
    
        const artist_scroll_speed = (artist_content_width - artist_wrapper_width) / 50
        document.querySelector('.spotify_artists .content').style = `--artist_scroll_duration: ${artist_scroll_speed}s`
        document.querySelector('.spotify_artists .content_wrapper').style = `--artist_scroll_duration: ${artist_scroll_speed}s`
        
        const song_wrapper = parseFloat(getComputedStyle(document.querySelector('.spotify_song')).width)
        const song_content = document.querySelector('.spotify_song > .content_wrapper > .content').getBoundingClientRect().width

        const song_scroll_speed = (song_content - song_wrapper) / 50
        document.querySelector('.spotify_song .content').style = `--song_scroll_duration: ${song_scroll_speed}s`
        document.querySelector('.spotify_song .content_wrapper').style = `--song_scroll_duration: ${song_scroll_speed}s`
        const song_scroll = song_content >= song_wrapper
        document.querySelector('.spotify_song').classList.toggle('scroll', song_scroll)
        document.querySelector('.spotify_now-playing').classList.toggle('art', album_art_url.length > 0)
    }
    
    const out = !same_song || !is_playing
    if(!same_song) { transition_out = true }
    document.querySelector('.spotify_now-playing').classList.toggle('playing', is_playing)
    document.querySelector('.spotify_now-playing').classList.toggle('in', !out)
}

function update() {
    if(transition_out) {
        transition_out = false
        return
    }
    try {
    currently_playing_track().then(json => {
        console.log(json)
        if(!json) return update_track()
        if(json.currently_playing_type == 'ad') return update_track()
        if(json.currently_playing_type == 'track') return update_track(json.item.name, json.item.artists, json.item.album.images?.find(x => true).url, json.is_playing)
    })
    } catch(e){}
}

setInterval(update, 500)
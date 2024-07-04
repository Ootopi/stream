import OAuth from '../common/OAuth/OAuth.js'

const SPOTIFY_CLIENT_ID = '05985642776142019b153167794fec64'
const SPOTIFY_REDIRECT_URI = 'https://ootopi.github.io/stream/now-playing'
const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'
const SPOTIFY_AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize'

const search_params = new URLSearchParams(location.search)
const reset = search_params.get('reset')
if(reset) localStorage.clear()

const align = search_params.get('align')
if(align) document.querySelector('.theme_align').setAttribute('href', `theme_align-${align}.css`)

const customizations = []
const song_color = search_params.get('song-color')
if(song_color) customizations.push(`--song-color: ${song_color}`)
const shadow_color = search_params.get('shadow-color')
if(shadow_color) customizations.push(`--shadow-color: ${shadow_color}`)
const artists_color = search_params.get('artist-color')
if(artists_color) customizations.push(`--artist-color: ${artists_color}`)
document.querySelector('.spotify_now-playing').style = customizations.join(';')

const oauth = new OAuth('spotify', {
    client_id: SPOTIFY_CLIENT_ID,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    authorization_endpoint: SPOTIFY_AUTH_ENDPOINT,
    token_endpoint: SPOTIFY_TOKEN_ENDPOINT,
    requested_scopes: 'user-read-playback-state user-read-currently-playing'
})

oauth.invalidate_access_token()

const dominant_color_canvas_context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })

function get_dominant_color(image) {
    dominant_color_canvas_context.drawImage(image, 0, 0, 1, 1)
    const i = dominant_color_canvas_context.getImageData(0, 0, 1, 1).data
    return `rgba(${i.join(',')})`
}

let retry_after = 0

function currently_playing_track() {
    return oauth.request_access_token().then(token => 
        fetch('https://api.spotify.com/v1/me/player/currently-playing',{ 
            headers: {'Authorization': `Bearer ${token}`}
        })
    ).then(response => {
        if(response.status == 200) return response.json()
        if(response.status == 204) return
        if(response.status == 429) {
            console.log(response.headers)
            retry_after = response.headers.get('retry-after')
            if(!retry_after) retry_after = 10
            console.log(`Retrying after ${retry_after}`)
            throw new Error('Too many requests')
        }
        throw new Error('Invalid response status')
    }).catch(() => {
        oauth.invalidate_access_token()
    })
}

let transition_out = false
document.querySelector('.spotify_art img').addEventListener('load', () => {
    document.querySelector('.spotify_now-playing .vinyl').style = `--color: ${get_dominant_color(document.querySelector('.spotify_art img'))}`
})

const spotify_artists_content = document.querySelector('.spotify_artists > .content_wrapper > .content')
const spotify_artists_content_wrapper = document.querySelector('.spotify_artists > .content_wrapper')
const spotify_song = document.querySelector('.spotify_song')
const spotify_song_content = document.querySelector('.spotify_song > .content_wrapper > .content')
const spotify_song_content_wrapper = document.querySelector('.spotify_song > .content_wrapper')
const spotify_now_playing = document.querySelector('.spotify_now-playing')
const spotify_artists = document.querySelector('.spotify_now-playing')
const spotify_art_img = document.querySelector('.spotify_art img')

function update_scroll(toggle_element, outer, inner, prefix) {
    const outer_width = parseFloat(getComputedStyle(outer).width)
    const inner_width = inner.getBoundingClientRect().width
    toggle_element.classList.toggle('scroll', inner_width >= outer_width)

    const scroll_duration = (inner_width - outer_width) / 50
    const style = `--${prefix}_scroll_duration: ${scroll_duration}s`
    outer.style = style
    inner.style = style
}

function update_track(track_name = '', artists = [], album_art_url = '', is_playing = false) {
    artists = artists.map(artist => artist.name).join(', ')

    const same_song = spotify_art_img.src == album_art_url && spotify_artists_content.textContent == artists && spotify_song_content.textContent == track_name

    if(!same_song) {
        spotify_art_img.src = album_art_url
        spotify_artists_content.textContent = artists
        spotify_song_content.textContent = track_name

        update_scroll(spotify_artists, spotify_artists_content_wrapper, spotify_artists_content, 'artists')
        update_scroll(spotify_song, spotify_song_content_wrapper, spotify_song_content,'song')
        
        spotify_now_playing.classList.toggle('art', album_art_url.length > 0)
    }
    
    const out = !same_song || !is_playing
    if(!same_song) { transition_out = true }
    spotify_now_playing.classList.toggle('playing', is_playing)
    spotify_now_playing.classList.toggle('in', !out)
}

let last_frame_time 
function update(time) {
    if(last_frame_time === undefined) last_frame_time = time
    const delta_time = time - last_frame_time
    retry_after -= delta_time / 1000
    if(retry_after > 0) {
        console.log(`Retrying after ${retry_after}`)
        return requestAnimationFrame(update)
    }

    currently_playing_track().then(json => {
        if(!json) return update_track()
        if(json.currently_playing_type == 'track') return update_track(json.item.name, json.item.artists, json.item.album.images?.find(x => true).url, json.is_playing)
        return update_track()
    }).then(() => requestAnimationFrame(update))
}

requestAnimationFrame(update)
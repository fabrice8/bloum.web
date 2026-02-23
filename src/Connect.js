

import IO from 'socket.io-client'

export default function Connect( app, baseURL ){
  
  this.app = app
  this.options = {
    extraHeaders: { 'X-User-Agent': 'Bloum.EXT/1.0' },
    reconnectionDelayMax: 20000,
    withCredentials: true,
    auth: { token: app.accessToken }
  }
  this.socket = null
  this.isConnected = false
  
  this.initiate = async () => {
    return new Promise( ( resolve, reject ) => {
      // Establish connection with Bloum Socket Server
      this.socket = IO( baseURL +'/', this.options )
      
      this.socket
      .on( 'connect', () => {
        this.app.setState( 'online', this.isConnected = true )
        resolve( this.isConnected )
      } )
      .on( 'disconnect', reason => {
        // Got disconnected
        this.app.setState( 'online', this.isConnected = false )

        // Manually reconnect when server disconnect
        if( reason === 'io server disconnect' )
          socket.connect()
      } )
      .on( 'connect_error', error => {
        console.log('Socket Connect Error: '+ error )
        reject( error )
      } )
      .on( 'error', error => {
        console.log('Socket Error: ', error )
        reject( error )
      } )
    } )
  }
  this.channel = ( type, id ) => {
    // Create channels by community, group, ...
    function compose( _event, emit ){
      return `${type.toUpperCase()}:${_event}${ !emit && id ? `:[${id}]` : ''}`
    }

    const emitter = {
      on: ( _event, listener ) => {
        this.socket.on( compose( _event ), listener )
        return emitter
      },
      once: ( _event, listener ) => {
        this.socket.once( compose( _event ), listener )
        return emitter
      },
      remove: _event => {
        this.socket.removeListener( compose( _event ) )
        return emitter
      },
      removeAll: _event => {
        this.socket.removeAllListeners( compose( _event ) )
        return emitter
      }
    }

    return emitter
  }
  // All emit are done in space context
  this.emit = ( _event, contextType, contextId, ...args ) => {

    if( !contextType || !contextId ){
      debugLog('Invalid Emit Event')
      return
    }

    this.socket.emit(`SPACE:${_event}`, { contextType, contextId }, ...args )
    return this
  }
}
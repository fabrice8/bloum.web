
export default function ChatHandler( ___, Connect, { type, id, name, profile, members } ){

  let 
  isDoingTimer = 0,
  isDoingPeople = []

  this.contextType = type
  this.contextId = id
  this.me = profile
  this.peer = {}
  this.Connect = Connect

  ___.setState({
    chats: [],
    members: {},
    hasNewMessages: false,
    doing: false,
    mountAction: {},
    showDialog: false
  })

  // Destructure peers/members
  members.map( each => {
    if( this.contextType == 'DM' && each.id !== this.me.id ) 
      this.peer = each // Receiver in DM Context
    
    ___.state.members[ each.id ] = each
  } )

  this.initialized = false
  this.previousChat = null
  this.chatBot = {
    id: 'bot',
    mode: 'welcome',
    message: this.contextType == 'DM' ? 
                      `This conversation is just between the two of you. Here you can send messages and share files with @${this.peer.name}.`
                      : `Very beginning of @${name} group. Members will be able to see all activities, including any files that have been shared in the group.`
  }
  
  ___.on( 'mount', () => this.initialize() )
  ___.on( 'input', () => this.initialized && this.scrollUp() )
  
	this.onFocus = () => ___.setState('hasNewMessages', false )
	this.onTextareaInput = () => {
		// Notify user doing typing to other peer(s)/member(s)
		this.Connect.emit( 'DO_ING', this.contextType, this.contextId, 'typing' )
	}
  
	this.onToSend = ( body, ack ) => {
		debugLog('Send new Message: ', body )
		// Display chat message
		const 
		datetime = Date.now(),
		chat = {
			...body,
			sender: this.me.id,
			photo: this.me.photo,
			datetime,
			chain: this.previousChat && this.previousChat.sender == this.me.id,
			status: 'SENDING'
		}
		
		this.appendChatMessage( chat, false )
		this.scrollUp()

		/* Save this as previous to identify and process
			specific display next chain chat messages from the same 
			sender.
		*/
		debugLog('Save chat message as previous to identify a chain display of the same sender')
		___.once( 'update', () => this.previousChat = chat )

		// Acknowledge reception of chat message from textarea
		debugLog('Clear chat message Textarea')
		typeof ack == 'function' && ack()

		/* `Send` will be trigger after medias attached to 
			the chat are uploaded successfully
		*/
		if( !Array.isArray( chat.medias ) || chat.medias.length ) return

		debugLog('No medias attached to the chat')
		// Send chat message right away (Contain only message)
		this.sendChat( datetime, body, false )
	}
	this.onToReply = ( body, ack ) => {
		debugLog('Send a Reply to a Message: ', body )

		// No chat message mounted for reply or invalid chat dataset
		if( ___.state.mountAction.type !== 'reply'
				|| typeof ___.state.mountAction.dataset !== 'object'
				|| !___.state.mountAction.dataset.thread ){
			debugLog('No Chat mounted for reply')
			return
		}
		
		// Display chat message
		const 
		datetime = Date.now(),
		refChat = ___.state.mountAction.dataset,
		chat = {
			...body,
			sender: this.me.id,
			photo: this.me.photo,
			datetime,
			status: 'SENDING'
		}
		
		// Add the chat to the reference thread
		this.appendChatMessage( chat, refChat.chatId )
		
		// Acknowledge reception of chat message from textarea
		debugLog('Clear chat message Textarea')
		this.onChatAction( false )
		typeof ack == 'function' && ack()

		/* `Send` will be trigger after medias attached to 
			the new reply chat are uploaded successfully
		*/
		if( !Array.isArray( body.medias ) || body.medias.length ) return

		debugLog('No medias attached to the reply chat')
		// Send the reply chat message right away (Contain only message)
		this.sendChat( datetime, body, refChat )
	}
	this.onChatAction = ( type, sectionIdx, dataset ) => {

		if( type === false ){
			debugLog('Previously mounted action is cancelled')
			___.setState('mountAction', {} )
			return
		}

		debugLog(`Mount <${type} action> to excute on a chat in <section ${sectionIdx}>: `, dataset )
		
		switch( type ){
			case 'edit': 
			case 'reply': ___.setState( 'mountAction', { type, dataset } ); break
			// Delete message is prompt therefore doesn't require to be mounted
			case 'delete': this.deleteChat( dataset, sectionIdx ); break

			default: ___.setState( 'mountAction', {} )
		}
	}
	this.onChatApplyChange = ( changes, ack ) => {
		/* Apply changes that occured after in
			relation with the previous chat action
			mounted: Edit, Reply, Reactions, ...

			Drop mounted action after changes get applied
			successfully.
		*/
		if( isEmpty( ___.state.mountAction ) ) return

		debugLog(`Change of <${___.state.mountAction.type} action> application returned: `, changes )
		switch( ___.state.mountAction.type ){
			// Edit action concern the chat's text message only for now
			case 'edit': this.sendChatUpdate({ message: changes }); break
		}

		// Unmount current action: No more valid
		debugLog(`Unmount <${___.state.mountAction.type} action>`)
		this.onChatAction( false )

		// Acknowledge reception of chat message from textarea
		debugLog('Clear chat message Textarea')
		typeof ack == 'function' && ack()
	}

	this.formatChatMessage = ( chat, isReply ) => {
		// Attach peer info & identify chain chat messages
		chat = { ...( ___.state.members[ chat.sender ] ), ...chat }

		// Ignore chain when chat is a reply
		if( !isReply )
			chat.chain = this.previousChat && this.previousChat.sender == chat.sender

		// Add sender information to thread chats
		if( chat.thread && chat.thread.total )
			chat.thread.list = chat.thread.list.map( each => {
				return { ...( ___.state.members[ each.sender ] ), ...each }
			} )
			
		if( !isReply ) this.previousChat = chat
		return chat
	}
	this.appendChatMessage = ( chat, threadChatId, sectionIdx ) => {
		// Target last section by default
		const idx = sectionIdx || ___.state.chats.length - 1

		// Append new message to chat thread
		if( threadChatId ){
			___.state.chats[ idx ] = ___.state.chats[ idx ].map( each => {
				// Update chat in a sub thread
				if( each.chatId == threadChatId ){
					each.thread.total++
					each.thread.list.push( chat )
				}
				
				return newObject( each )
			} )
		
			___.setStateDirty('chats')
			debugLog('Appended new Chat Message a thread: ', chat )
			return
		}
		
		// Create new chat message section in case this context isn't the active one
		if( !___.state.hasNewMessages 
				&& this.Connect.app.state.context.id !== this.contextId ){
			debugLog('Push new chats Section Array for new chat message got when context isn\'t active')
			___.state.chats.push([])
			___.setState('hasNewMessages', true )
		}

		// First chat message
		if( !___.state.chats.length ) 
			___.state.chats[0] = [ chat ]

		// Display new chat message
		else {
			const idx = ___.state.chats.length - 1 // Append to last section
			___.state.chats[ idx ] = [ ...( ___.state.chats[ idx ] ), chat ]
		}
	
		___.setStateDirty('chats')
		debugLog('Appended new Chat Message to last Chat session Array: ', chat )
	}
	this.updateChatMessage = ( datetime, updates, replyTo, sectionIdx ) => {
		// Apply update to displayed chat message
		const idx = sectionIdx || ___.state.chats.length - 1 // Target last section by default
		___.state.chats[ idx ] = ___.state.chats[ idx ].map( each => {
			// Update chat in a sub thread
			if( replyTo && each.datetime == replyTo.datetime )
				each.thread.list = each.thread.list.map( chat => {
					if( chat.datetime == datetime 
							|| ( updates.chatId && chat.chatId == updates.chatId ) )
						chat = { ...chat, ...updates }

					return chat
				} )
			
			// Update chat in the main thread
			else if( each.datetime == datetime )
				each = { ...each, ...updates }
				
			return newObject( each )
		} )
		
		___.setStateDirty('chats')
		debugLog('Updated Chat Message: ', datetime, idx, updates )
	}
	this.deleteChatMessage = ( datetime, sectionIdx ) => {
		// Remove a chat from a given section
		if( sectionIdx === undefined ) return

		___.state.chats[ sectionIdx ] = ___.state.chats[ sectionIdx ].filter( each => { return each.datetime != datetime } )

		___.setStateDirty('chats')
		debugLog('Chat Message Deleted: ', datetime, sectionIdx )
	}
	
	this.dialog = ( options ) => { ___.state.showDialog = options }
	this.getURLPath = () => { return `${___.App.data.baseURL}/${this.contextType}/${this.contextId}` }
	this.scrollUp = () => {
		const elem = ___.getEl('scroll-body')
		$(elem).animate({ scrollTop: elem.scrollHeight }, 400 )

		debugLog('Scroll Chat Content Up: ')
	}
  this.listeners = () => {
    /* Initialize Socket channel

      IMPORTANT: `this.Connect.app` give access 
                  to main component methods to avoid
                  emitting event all the way back to the
                  main.
    */
		debugLog(`Initialize ${this.contextType} Channel`)
		this.Connect.channel( this.contextType, this.contextId )

		// Received new member: only for group
		.on( 'MEMBER_NEW', ({ member, by }) => {
      debugLog(`Event: New Member <${member.id}> added to ${this.contextType}`)

			if( member.id === this.me.id ) return
      
      // Add to members list
      ___.state.members[ member.id ] = member
      ___.setStateDirty('members')
      
      // Add bot chat message of new added member
      this.appendChatMessage({
        sender: 'bot',
        mode: 'alert',
        message: `@${member.name} was added to the ${this.contextType} by @${by.name}`
      })
		})
		// Received new chat message
		.on( 'CHAT_NEW', ( chat, replyTo ) => {
      debugLog(`Event: New Chat Message in ${this.contextType}`)

      // Ignore bouncing self sent chat messages
			if( chat.sender === this.me.id ) return

			// Append to all chat
      this.appendChatMessage( this.formatChatMessage( chat, !!replyTo ), replyTo )
      this.scrollUp()
		})
		// Display user DO-ING indicator: Typing, Recording, ...
		.on( 'DO_ING', ({ id, type }) => {

      clearTimeout( isDoingTimer )
      let label = type

      // Add user(s) doing's name(s) in group context
      if( this.contextType == 'group' ){
        const 
        peerName = ___.state.members[ id ].name.split(/\s+/g)[0],
        getLabel = () => { return `${isDoingPeople.join(', ')} ${isDoingPeople.length > 1 ? 'are' : 'is'} ${type}` }

        if( !isDoingPeople.includes( peerName ) )
          isDoingPeople.push( peerName )
        
        ___.setState( 'doing', getLabel() )
        isDoingTimer = setTimeout( () => {
          // Remove off peers that go inactive
          isDoingPeople = isDoingPeople.filter( each => { return peerName !== each } )
          ___.setState( 'doing', isDoingPeople.length ? getLabel() : false )
        }, 2000 )

        return 
      }
      
      // DM context
			___.setState( 'doing', label )
			isDoingTimer = setTimeout( () => ___.setState( 'doing', false ), 2000 )
		} )
  }

	this.initialize = async () => {
		// Fetch 100 recent chats
		debugLog(`Initialize ${this.contextType}: Fetch 100 recent chats`)
		await this.fetchChats( 100 )

		// Initialize Event listener channel
    this.listeners()

		this.initialized = true
	}
	this.fetchChats = async ( limit, offset ) => {
		debugLog('Fetch chats API Request')
		try {
			const { error, message, chats } = await ___.App.Request(`${this.getURLPath()}/chats`, { method: 'GET', headers: ___.App.data.headers })
			if( error ) throw new Error( message )

			// Format each message and render them in bulk
			chats.length && ___.state.chats.unshift( chats.map( each => this.formatChatMessage.bind(this)( each ) ) )
			___.setStateDirty('chats')
			debugLog('Fetched list `unshifted` into chat-section Array', chats.length )

			___.once( 'update', this.scrollUp )
		}
		catch( error ){ debugLog('Failed Fetching chats: ', error ) }
	}
	this.sendChat = async ( temptime, body, replyTo ) => {
		/* Use `temptime` (temporary local time) as id of 
			the message in the section display thread for
			preliminary updates.
		*/
		try {
			const
			payload = {
				method: 'POST',
				headers: ___.App.data.headers,
				body
			}
			debugLog('Submit Chat Message API Request: ', payload )

			const { error, message, chatId } = await ___.App.Request(`${this.getURLPath()}/chat/send${replyTo ? '?replyTo='+ replyTo.chatId : ''}`, payload )
			if( error ) throw new Error( message )
			
			const updates = {
				chatId, 
				medias: body.medias, // Update with CDN media links if upload happened
				status: 'SENT' 
			}

			// Update sub/reply thread
			if( replyTo )
				this.updateChatMessage( temptime, updates, replyTo )
			
			// Main thread
			else {
				this.updateChatMessage( temptime, updates, false )
				this.scrollUp()
			}
		}
		catch( error ){
			debugLog('Failed Sending Message: ', error )
			this.updateChatMessage( temptime, { status: 'FAILED' }, false )
		}
	}
	this.sendChatUpdate = async ( updates ) => {
		const { chatId, datetime } = ___.state.mountAction.dataset
		
		// Pre-apply changes locally before it get send
		debugLog('Apply Chat changes locally before they get send to server: ', updates )
		this.updateChatMessage( datetime, { ...updates, status: 'SENDING' }, false )
		try {
			const
			payload = {
				method: 'PATCH',
				headers: ___.App.data.headers,
				body: updates
			}
			debugLog('Send Chat Update API Request: ', payload )

			const { error, message, chat } = await ___.App.Request(`${this.getURLPath()}/chat/${chatId}/update`, payload )
			if( error ) throw new Error( message )
			
			debugLog('Confirmation of changes applied successfully: ', chat )
			this.updateChatMessage( datetime, { ...updates, status: 'SENT' }, false )
		}
		catch( error ){
			debugLog('Failed Sending Chat Updates: ', error )
			this.updateChatMessage( datetime, { status: 'FAILED' }, false )
		}
	}
	this.deleteChat = async ( chat, sectionIdx, confirmed ) => {

		// Require confirmation
		if( confirmed !== true ){
			debugLog('Ask confirmation to delete Chat Message')
			
			const message = `<br><br><div class="theme-bg rounded px-1 py-75"><i class="bx bxs-quote-alt-right font-large-1 float-left" style="padding-right:1rem"></i><p>${chat.message}</p></div>`
			this.dialog({
				type: 'warning',
				message: `Are you sure you want to delete this message? This cannot be undone. ${message}`,
				actions: { yes: (function(){ this.deleteChat( chat, sectionIdx, true ) }).bind(this) }
			})
			return
		}

		try {
			const
			payload = {
				method: 'DELETE',
				headers: ___.App.data.headers
			}
			debugLog('Delete Chat API Request: ', payload )

			const { error, message } = await ___.App.Request(`${this.getURLPath()}/chat/${chat.chatId}/delete`, payload )
			if( error ) throw new Error( message )
			
			debugLog('Confirmation: ', message )
			this.deleteChatMessage( chat.datetime, sectionIdx )
		}
		catch( error ){ debugLog('Failed Deleting Chat Message: ', error ) }
	}
}
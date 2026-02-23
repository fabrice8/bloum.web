
export default __ => {
  // Declare space event listeners
  __.Connect.channel('space')
  // New person online
  .on( 'PEOPLE_CONNECTED', people => {
    debugLog(`Event: <${people.id}> is connected`)

    __.state.people[ people.id ].status = 'online'
    __.setStateDirty('people')
  } )
  // Person gone offline
  .on( 'PEOPLE_DISCONNECTED', people => {
    debugLog(`Event: <${people.id}> is disconnected`)

    __.state.people[ people.id ].status = 'away'
    __.setStateDirty('people')
  } )
  // When new people get added to the space
  .on( 'PEOPLE_NEW', people => {
    debugLog(`Event: New member <${people.id}> is added to the space`)

    __.state.people[ people.id ] = people
    __.setStateDirty('people')
  } )
  // Get invitation to join a public Group
  .on( 'PUBLIC_GROUP_INVITATION', ({ id }) => {
    debugLog('Event: Invitation to Join a <public group>', id )
    __.onOpen( 'group', { id } )
  } )
  // Get invitation to join a public Community
  .on( 'PUBLIC_COMMUNITY_INVITATION', ({ id }) => {
    debugLog('Event: Invitation to Join a <public community>', id )
    __.onOpen( 'community', { id } )
  } )
  
  // Declare DM event listeners in a space
  __.Connect.channel( 'DM', __.state.profile.id )
  // Get new DM request and open as hidden context
  .on( 'NEW', ({ id, peer }) => {
    debugLog('Event: New DM Initiated', id )
    __.onOpen( 'DM', { ...peer, hidden: true } )
  } )
  // Get invitation to join a new DM room
  .on( 'INVITATION', ({ id }) => {
    debugLog('Event: Invitation to Join a DM', id )
    __.Connect.emit('JOIN', 'DM', id )
  } )
  
  // Declare Group event listeners in a space
  __.Connect.channel( 'group', __.state.profile.id )
  // Get invitation to join a private Group
  .on( 'INVITATION', ({ id }) => {
    debugLog('Event: Invitation to Join a <private group>', id )
    __.onOpen( 'group', { id } )
  } )
  
  // Declare Community event listeners in a space
  __.Connect.channel( 'community', __.state.profile.id )
  // Get invitation to join a private Community
  .on( 'INVITATION', ({ id }) => {
    debugLog('Event: Invitation to Join a <private community>', id )
    __.onOpen( 'community', { id } )
  } )
}
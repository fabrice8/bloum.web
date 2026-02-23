
import eventList from './events.json'

export default async ( __, headers ) => {
  __.state.loading = true
  try {
    if( !__.spaceId ){
      // Administrators only can setup a new bloum space
      if( __.input.user.accounttype !== 'ADMIN' )
        return __.setState({
                            loading: false,
                            sessionError: {
                              type: 'INFO',
                              message: 'This application is not activated. Contact Administration for further notice'
                            }
                          })
      
      // Setup space
      const
      { name, description, logo, domains, settings } = __.input.tenant,
      payload = {
        ...headers,
        method: 'POST',
        body: {
          name,
          description,
          logo,
          domain: domains.full, // Static subdomain

          // Workspace settings
          settings: {
            theme: {
              name: 'default',
              mode: 'light'
            },
            features: {
              DM: true,
              group: true,
              community: true,
              posting: false
            }
          }
        }
      },
      /* Create space if not yet, otherwise, 
          return spaceId related to the domain
      */
      { error, status, message, spaceId } = await __.App.Request('/space/create', payload )
      if( error ) throw new Error( message )
      
      /* Store space ID by tenant domain: In case same computer-browser 
        is use by different users to avoid space ID collusion
      */
      __.spaceId = spaceId
      __.App.UIStore.set( __.ucAttr('space-id', domains.full ), spaceId )

      // To display walkthrough to users of the new space
      if( status === 'SPACE::CREATED' ){
        __.walkthrough = true
        
        /* Assign the Bloum Space ID to the tenant settings
            NOTE: request to Multipple LXP endpoint: '/institution/settings/update'
        */
        await __.App.Request('/institution/settings/update', { method: 'PUT', body: { bis: { spaceId } } })
      }
    }
    
    // Fetch space informations
    const { error, message, space } = await __.App.Request(`/space/${__.spaceId}`, { method: 'GET', ...headers } )
    if( error ) throw new Error( message )

    // Convert people Array to Object: `people.id:people`
    const people = {}
    space.people.map( each => people[ each.id ] = each )
    
    __.setState({ space, people })
    
    // Get current user access credentials or add him if not yet
    if( !__.accessToken ){
      const token = await __.getUserAccessToken()
      if( !token )
        __.state.sessionError = {
          type: 'IMPORTANT',
          message: 'Invalid User Access'
        }

      /* Store token by user email: In case same computer-browser 
        is use by different users to avoid access token collusion
      */
      __.accessToken = token
      __.App.UIStore.set( __.ucAttr('access-token'), token )

      /* Assign the Bloum access token to the user's settings
          NOTE: request to Multipple LXP endpoint: '/user/settings/update'
      */
      await __.App.Request('/user/settings/update', { method: 'PUT', body: { bisToken: token } })

      /* Assign the Bloum this access token to the tenant settings
          as adminToken: Required to perform admin operation on a 
          space via independent API request from Multipple platform

          Eg. To create group from admin account
      */
      __.walkthrough === true
      && __.input.user.accounttype === 'ADMIN'
      && ( !__.input.tenant.settings.bis || !__.input.tenant.settings.bis.adminToken )
      && await __.App.Request('/institution/settings/update', { method: 'PUT', body: { 'bis.adminToken': token } })
    }

    // Request header authorizing access to this user only
    __.App.data.headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer '+ __.accessToken,
      'X-User-Agent': 'Bloum.WEB/1.0',
      /* Use to indicate restriction to process data 
        in this space's scope only (Optional)

        Eg. `/v1/group/list` endpoint will only return groups
            including this user in this space only.
      */
      'X-Space-ID': __.spaceId
    }
    
    // Load previous or new session space look
    __.loadSession()
  }
  catch( error ){ debugLog('[Bloum]: Failed Initializing: ', error ) }

  __.state.loading = false

  // Setup Bloum webhook event app in-case doesn't exist
  try {
    // Get tenant main WES Event Provider subscription request URL
    const { error, message, apps } = await __.App.Request('/app/list/wes', { method: 'GET' })
    if( error ) throw new Error( message )
    
    const
    body = {
      type: 'WES',
      name: 'Bloum Events App',
      description: "Subscription to bloum event like when groups, communities, ... are created for Multipple Platform.",
      requestURL: apps[0].configs.url,
      eventTarget: __.spaceId,
      eventList
    },
    // Create New App or return `appId` if already exist
    response = await __.App.Request('/app/create', { method: 'POST', body } )
    if( response.error ) throw new Error( response.message )

    console.log('AppId: ', response )
  }
  catch( error ){ debugLog('[Bloum]: Failed Creating WES-App: ', error ) }
}
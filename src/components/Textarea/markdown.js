let cursorPosition // Out of scope to keep track of changes

export const parseLink = str => {
  
  return { HTML: str, cursorPosition: 1 }
}

export const parseStyle = ( type, str ) => {

  let tag, mark
  switch( type ){
    case 'bold': tag = 'strong'; mark = '*'; break
    case 'italic': tag = 'em'; mark = '_'; break
    case 'strikethrough': tag = 's'; mark = '--'; break
  }
  
  const HTML = str
        .replace( new RegExp(`<${tag}>\\${mark}([a-zA-Z_]+)<\/${tag}>`, 'g'), ( match, text ) => { return `${mark}${text}` } )
        // Deleting content from withing to left
        .replace( new RegExp(`<${tag}>([a-zA-Z_]+)\\${mark}<\/${tag}>`, 'g'), ( match, text ) => {
          cursorPosition = 0 // cursor position 0
          return `<span class="cursor">${text}${mark}</span>` 
        } )
        // Inserting new style
        .replace( new RegExp(`\\${mark}([a-zA-Z_]+)\\${mark}`, 'g'), ( match, text ) => {
          cursorPosition = 1 // cursor position 1
          // Wrap the text with targeted HTML tag
          return `<${tag}>${text}</${tag}><span class="cursor">\uFEFF</span>`
        } )
  
  return { HTML, cursorPosition }
}

export const parseHeading = str => {

  let
  tag = 'h([0-6])',
  mark = '#'
  
  const HTML = str
        // Deleting content from right to left
        .replace( new RegExp(`<${tag}>\\${mark}([a-zA-Z_]+)<\/${tag}>`, 'g'), ( match, text ) => { return `${mark}${text}` } )
        // Deleting content from withing to left
        .replace( new RegExp(`<${tag}>([a-zA-Z_]+)\\${mark}<\/${tag}>`, 'g'), ( match, text ) => {
          cursorPosition = 0 // cursor position 0
          return `<span class="cursor">${text}${mark}</span>` 
        } )
        // Inserting new style
        .replace( new RegExp(`\\${mark}([a-zA-Z_]+)\\${mark}`, 'g'), ( match, keys, text ) => {
          cursorPosition = 1 // cursor position 1
          hCount = keys.length
          // Wrap the text with targeted HTML heading tag
          return `<h${hCount}>${text}</h${hCount}><span class="cursor">\uFEFF</span>`
        } )
  
  return { HTML, cursorPosition }
}

export const parseBlock = ( type, str ) => {
  
  return { HTML: str, cursorPosition: 1 }
}

export const parseCode = ( type, str ) => {

  let tag, mark
  switch( type ){
    case 'inline-code': tag = 'code'; mark = '`'; break
  }
  
  const HTML = str
        // Deleting content from right to left
        .replace( new RegExp(`<${tag}>\\${mark}(.[^\`]+)<\/${tag}>`, 'g'), ( match, text ) => { return `${mark}${text}` } )
        // Deleting content from withing to left
        .replace( new RegExp(`<${tag}>(.[^\`]+)\\${mark}<\/${tag}>`, 'g'), ( match, text ) => {
          cursorPosition = 0 // cursor position 0
          return `<span class="cursor">${text}${mark}</span>` 
        } )
        // Inserting new style
        .replace( new RegExp(`\\${mark}(.[^\`]+)\\${mark}`, 'g'), ( match, text ) => {
          cursorPosition = 1 // cursor position 1
          // Wrap the text with targeted HTML tag
          return `<${tag}>${text}</${tag}><span class="cursor">\uFEFF</span>`
        } )
  
  return { HTML, cursorPosition }
}

export const parseTable = str => {
  
  return { HTML: str, cursorPosition: 1 }
}


export default ( str, parseList ) => {

  if( !Array.isArray( parseList ) || !parseList.length ){
    console.log('[Markdown]: Undefined Parse List')
    return {}
  }

  let result = { HTML: str }

  cursorPosition = undefined

  result.HTML = str
  // Deleting content from right to left
  .replace(/\<br\>/g, match => {
    result.cursorPosition = 1
    return `<span class="cursor"></span>`
  })
  .replace(/\<span\>\<\/span\>/g, '')
  
  parseList.map( each => {
    switch( each ){
      case 'link': result = parseLink( result.HTML ); break
      case 'bold':
      case 'italic':
      case 'underline':
      case 'strikethrough': result = parseStyle( each, result.HTML ); break
      case 'heading': result = parseHeading( result.HTML ); break
      case 'alert':
      case 'blockquote': result = parseBlock( each, result.HTML ); break
      case 'block-code': 
      case 'inline-code': result = parseCode( each, result.HTML ); break
      case 'table': result = parseTable( result.HTML ); break
    }
  } )
  
  return result
}
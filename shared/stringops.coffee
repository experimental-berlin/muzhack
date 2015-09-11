@trimWhitespace = (str) -> S.trim(null, str)
@escapeHtml = (str) ->
  div = document.createElement('div')
  div.appendChild(document.createTextNode(str))
  div.innerHTML

logger = new Logger("displayProject")

class ProjectTab
  constructor: (@title) ->
    @name = @title.toLowerCase()

  classes: ->
    activeTab = Iron.controller().state.get('activeTab')
    if activeTab == @name
      logger.debug("#{@name} is active tab")
      'active'
    else
      ''

Template.displayProject.helpers(
  creationDateString: ->
    moment(@created).format("MMMM Do YYYY")
  userFullName: ->
    @ownerName
  projectTabs: -> [
    new ProjectTab('Description')
    new ProjectTab('Instructions')
  ]
  displayedText: ->
    activeTab = Iron.controller().state.get('activeTab')
    logger.debug("Displaying project #{activeTab}")
    if activeTab == 'description'
      @text
    else if activeTab == 'instructions'
      @instructions || """Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed convallis
risus a nisl iaculis, nec viverra diam imperdiet. Ut quis lorem accumsan metus luctus luctus
et ac eros. Etiam libero diam, sodales a convallis sed, egestas in nibh. Integer nulla augue,
tempus nec est in, ullamcorper fringilla ante. Pellentesque ornare neque id tortor finibus gravida.
In eleifend libero dui, at hendrerit enim consectetur vel. Mauris sed libero id magna egestas
lacinia. Nunc id justo vel nisi dignissim imperdiet. Aliquam erat volutpat. Sed nulla magna,
commodo nec blandit consectetur, vestibulum non ligula. Proin tincidunt ligula sit amet dolor
ultrices euismod. Phasellus quis augue consectetur, fermentum eros in, varius mauris. Sed nec lorem
lobortis, congue ipsum et, tempus nulla. Quisque fringilla magna vitae augue tempus sollicitudin.
Duis quis velit quam.

Nulla sed enim a massa fringilla ullamcorper. Curabitur ac mi sit amet augue aliquam rhoncus ac eget
leo. Pellentesque diam metus, aliquet non vehicula in, fermentum non dolor. Phasellus elementum arcu
a libero auctor, non luctus risus imperdiet. Sed a scelerisque justo. Etiam porta dignissim libero
ac rhoncus. Proin nec turpis massa.

Donec vel pretium tellus. Phasellus congue vitae ex sed mollis. Pellentesque blandit laoreet nulla,
id hendrerit eros tincidunt eget. Nullam maximus ornare gravida. Praesent nec porta orci.
Fusce at ante ultricies, fringilla lorem aliquam, gravida massa. Aenean et consectetur quam.
Donec sapien diam, gravida aliquam velit sollicitudin, imperdiet placerat tortor.

Sed tempor, augue sed ultrices commodo, nisi quam blandit arcu, quis dapibus justo mi sed tortor.
Phasellus faucibus nibh mi. Morbi quis urna orci. Quisque ut nisl pulvinar, pellentesque nisi id,
porta odio. Phasellus et odio semper, ullamcorper enim eu, finibus purus. Nulla sed tellus
vestibulum, viverra velit at, consequat nibh. Cras et posuere turpis, ultrices tristique mi.
Vivamus faucibus non nibh pretium dapibus. Donec id tempus ipsum. Praesent turpis metus,
venenatis quis eleifend sit amet, dictum id sem. Aenean laoreet enim ut euismod cursus. Curabitur
mollis dignissim felis nec auctor. Nullam sit amet orci feugiat, pulvinar nunc eget, maximus massa.
Etiam accumsan turpis quis convallis gravida. Nam ut sagittis leo. Maecenas congue ligula sed sapien
consectetur, ac venenatis urna scelerisque.

Cras tempus tellus lacus, malesuada accumsan mi blandit vel. Phasellus nulla tellus, porttitor
suscipit leo quis, finibus molestie lectus. Donec feugiat massa quis vulputate mollis. Vivamus
accumsan, lectus nec porttitor lacinia, tellus odio porttitor erat, vitae accumsan arcu tellus quis
tellus. Vivamus in maximus nisi. Donec eget dignissim orci. Donec at est eu enim euismod ullamcorper
quis ultricies ante.
"""
)
Template.displayProject.events({
  'click .tabs > li': ->
    Iron.controller().state.set('activeTab', @name)
    logger.debug("Set activeTab: #{@name}")
})

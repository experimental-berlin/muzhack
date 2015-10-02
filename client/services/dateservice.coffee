class @DateService
  displayDate: (date) ->
    moment(date).format("YYYY-MM-DD")
  displayDateTextual: (date) ->
    moment(date).format("MMMM Do YYYY")

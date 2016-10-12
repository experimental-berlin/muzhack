'use strict'
let mandrill = require('mandrill-api/mandrill')
let logger = require('@arve.knudsen/js-logger').get('emailer')

let {getEnvParam,} = require('./environment')

module.exports = {
  sendEmail: ({subject, html, emailAddress, name,}) => {
    let mandrillClient = new mandrill.Mandrill(getEnvParam('MANDRILL_SECRET'))
    return new Promise((resolve, reject) => {
      let message = {
        html,
        subject,
        from_email: `contact@muzhack.com`,
        from_name: `MuzHack`,
        to: [{
          email: emailAddress,
          name,
          type: 'to',
        },],
        headers: {
          'Reply-To': `no-reply@muzhack.com`,
        },
      }
      logger.debug(`Sending email to '${emailAddress}'...`)
      mandrillClient.messages.send({
        message: message,
        async: true,
      }, () => {
        logger.debug(`Sent email to '${emailAddress}' successfully`)
        resolve()
      }, (error) => {
        logger.warn(
            `Unable to send email to '${emailAddress}', Mandrill error: '${error.message}'`)
        reject(`A Mandrill error occurred sending email to '${emailAddress}': '${error.message}'`)
      })
    })
  },
}

'use strict'

const request = require('request-micro')
const aws4 = require('aws4')
const assert = require('assert')
const encoder = require('form-urlencoded')

module.exports = makeClient

function noOp() {}
function makeClient(options) {
  let conf = Object.assign({}, options)
  assert(conf.region, 'Region is a required configuration for SES clients')

  // Configure optional logger
  if ('logger' in context) {
    context.log = context.logger.log
    delete context.logger
  } else {
    context.log = noOp
  }

  return {
    sendEmail: sendEmail.bind(null, context)
  }
}

function sendEmail(context, options, callback) {
  let sendResult
  // encodeBody and aws4.sign can both throw before the promise starts
  try {
    sendResult = request(
      aws4.sign({
        service: 'email',
        region: context.region,
        method: 'POST',
        protocol: 'https:',
        path: '/',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: encodeBody(options)
      })
    )
  } catch (e) {
    context.log(e)
    sendResult = Promse.reject(e)
  }
  if (!callback) return sendResult
  sendResult
    .then(result => callback(null, result))
    .catch(error => callback(error))
}

function encodeBody(options) {
  validateParams(options)
  return encoder(Object.assign({}, options, { Action: 'SendEmail' }))
}

const requiredEmailParams = ['Source', 'Destination', 'Message']
function validateParams(params) {
  requiredEmailParams.forEach(prop =>
    assert(options[prop], `The "${prop}" property is required`)
  )
  assert(options.Message.Body, 'The "Message.Body" property is required')
  assert(options.Message.Subject, 'The "Message.Subject" property is required')
  assert(
    options.Message.Subject.Data,
    'The "Message.Subject.Data" property is required'
  )
  if ('Html' in options.Message.Body) {
    assert(
      options.Message.Body.Html.Data,
      'The "Message.Body.Html.Data" property is required when using Html'
    )
  } else if ('Text' in options.Message.Body) {
    assert(
      options.Message.Body.Text.Data,
      'The "Message.Body.Text.Data" property is required when using Text'
    )
  } else {
    throw new Error('One of "Html", "Text" is required on Message.Body')
  }
}

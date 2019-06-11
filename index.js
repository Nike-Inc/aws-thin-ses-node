'use strict'

const request = require('request-micro')
const aws4 = require('aws4')
const assert = require('assert')
const encoder = require('aws-form-urlencoded')

module.exports = makeClient

function noop () {}
function functionElseNoop (func) {
  if (func && typeof func === 'function') {
    return func
  }
  return noop
}
function logWrapper (loggerArg) {
  const logger = loggerArg || {}
  return {
    error: functionElseNoop(logger.error),
    warn: functionElseNoop(logger.warn),
    info: functionElseNoop(logger.info),
    debug: functionElseNoop(logger.debug)
  }
}

function makeClient (options) {
  let context = Object.assign({}, options)
  assert(context.region, 'Region is a required option for SES clients')

  // Configure optional logger
  context.logger = logWrapper(context.logger)

  return {
    sendEmail: sendEmail.bind(null, context)
  }
}

function sendEmail (context, options, callback) {
  let sendResult

  // encodeBody and aws4.sign can both throw before the promise starts
  try {
    context.logger.info('SES: starting send', options)
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
        body: encodeBody(context, options)
      })
    ).then(response => {
      if (response.statusCode >= 400) {
        context.logger.error(
          'SES: ',
          response.statusCode,
          response.data && response.data.toString()
        )
        return Promise.reject(
          new Error(
            'Amazon SES service returned status code: ' + response.statusCode
          )
        )
      }
      return response
    })
  } catch (e) {
    context.logger.error('SES: ', e)
    sendResult = Promise.reject(e)
  }
  if (!callback) {
    return sendResult.then(result => {
      context.logger.info(
        'SES: finished',
        result.statusCode,
        result.statusMessage
      )
      context.logger.info('SES: data', result.data.toString())
      return result
    })
  }
  sendResult
    .then(result => callback(null, result))
    .catch(error => callback(error))
}

function encodeBody (context, options) {
  context.logger.info('SES: validating params', options)
  validateParams(options)
  context.logger.info('SES: params validated')

  let body = encoder(Object.assign({}, options, { Action: 'SendEmail' }))
  context.logger.info('SES: body encoded', body)
  return body
}

const requiredEmailParams = ['Source', 'Destination', 'Message']

function validateParams (params) {
  requiredEmailParams.forEach(prop =>
    assert(params[prop], `The "${prop}" property is required`)
  )
  assert(params.Message.Body, 'The "Message.Body" property is required')
  assert(params.Message.Subject, 'The "Message.Subject" property is required')
  assert(
    params.Message.Subject.Data,
    'The "Message.Subject.Data" property is required'
  )
  if ('Html' in params.Message.Body) {
    assert(
      params.Message.Body.Html.Data,
      'The "Message.Body.Html.Data" property is required when using Html'
    )
  } else if ('Text' in params.Message.Body) {
    assert(
      params.Message.Body.Text.Data,
      'The "Message.Body.Text.Data" property is required when using Text'
    )
  } else {
    throw new Error('One of "Html", "Text" is required on Message.Body')
  }
}

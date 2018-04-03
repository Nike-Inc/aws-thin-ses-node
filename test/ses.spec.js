'use strict'

const test = require('blue-tape')
const nock = require('nock')
const ses = require('../index')

const sesUrl = 'https://email.us-west-2.amazonaws.com'

test('ses should throw if a region is not passed to constructor', t => {
  t.plan(1)
  try {
    const client = ses({})
  } catch (e) {
    t.equal(e.message, 'Region is a required option for SES clients')
  }
  t.end()
})

test('ses should use the logger passed into the constructor', t => {
  t.plan(3) // Console gets called three times before error
  let logger = {
    log: function (message) {
      t.ok(typeof message === 'string')
    }
  }
  const client = ses({ region: 'us-west-2', logger: logger })
  try {
    client.sendEmail({})
  } catch (e) {
    t.end()
  }
})

test('ses should require Source, Destination, and Message when sending e-mail', t => {
  t.plan(3)
  const client = ses({ region: 'us-west-2' })

  client.sendEmail({}, function (err) {
    t.equal(err.message, 'The "Source" property is required')
  })
  client.sendEmail({ Source: {} }, function (err) {
    t.equal(err.message, 'The "Destination" property is required')
  })
  client.sendEmail({ Source: {}, Destination: {} }, function (err) {
    t.equal(err.message, 'The "Message" property is required')
  })
})

test('ses should require Body and Subject on Message when sending e-mail', t => {
  t.plan(2)
  const client = ses({ region: 'us-west-2' })

  client.sendEmail({ Source: {}, Destination: {}, Message: {} }, function (err) {
    t.equal(err.message, 'The "Message.Body" property is required')
  })
  client.sendEmail({ Source: {}, Destination: {}, Message: { Body: 'body'} }, function (err) {
    t.equal(err.message, 'The "Message.Subject" property is required')
  })
})

test('ses should require Data property on Message.Subject when sending e-mail', t => {
  t.plan(1)
  const client = ses({ region: 'us-west-2' })

  client.sendEmail({ Source: {}, Destination: {}, Message: { Body: {}, Subject: {} } }, function (err) {
    t.equal(err.message, 'The "Message.Subject.Data" property is required')
  })
})

test('ses should require either Html or Text property on Message.Body when sending e-mail', t => {
  t.plan(1)
  const client = ses({ region: 'us-west-2' })

  client.sendEmail({ Source: {}, Destination: {}, Message: { Body: {}, Subject: { Data: 'Data' } } }, function (err) {
    t.equal(err.message, 'One of "Html", "Text" is required on Message.Body')
  })
})

test('ses should require Data Property on Message.Body.Html or Message.Body.Text when sending e-mail', t => {
  t.plan(2)
  const client = ses({ region: 'us-west-2' })

  client.sendEmail({ Source: {}, Destination: {}, Message: { Body: { Html: {} }, Subject: { Data: 'Data' } } }, function (err) {
    t.equal(err.message, 'The "Message.Body.Html.Data" property is required when using Html')
  })
  client.sendEmail({ Source: {}, Destination: {}, Message: { Body: { Text: {} }, Subject: { Data: 'Data' } } }, function (err) {
    t.equal(err.message, 'The "Message.Body.Text.Data" property is required when using Text')
  })
})

test('ses should validate the template params when sending Template as an option', t => {
  t.plan(3)
  const client = ses({ region: 'us-west-2' })

  client.sendEmail({ Template: 'test' }, function (err) {
    t.equal(err.message, 'The "Source" property is required')
  })

  client.sendEmail({ Source: {}, Template: 'test' }, function (err) {
    t.equal(err.message, 'The "Destination" property is required')
  })

  client.sendEmail({ Source: {}, Destination: {}, Template: 'test' }, function (err) {
    t.equal(err.message, 'The "TemplateData" property is required')
  })
})

test('ses should fail if http request to aws fails', t => {
  t.plan(1)
  const client = ses({ region: 'us-west-2' })
  nock(sesUrl).post('/').replyWithError({ message: 'Something bad happened' })

  client.sendEmail({ Source: {}, Destination: {}, Message: { Body: { Html: { Data: 'Data' } }, Subject: { Data: 'Data' } } }, function (err) {
    t.equal(err.message, 'Something bad happened')
  })
})

test('ses should fail if http request to aws ses server returns a 400 or higher response code', t => {
  t.plan(1)
  const client = ses({ region: 'us-west-2' })
  nock(sesUrl).post('/').reply(400, { message: 'Bad request' })

  client.sendEmail({ Source: {}, Destination: {}, Message: { Body: { Html: { Data: 'Data' } }, Subject: { Data: 'Data' } } }, function (err) {
    t.equal(err.message, 'Amazon SES service returned status code: 400')
  })
})

test('ses should send a request to aws ses server and return the response', t => {
  t.plan(1)
  const client = ses({ region: 'us-west-2' })
  nock(sesUrl).post('/').reply(200, { message: 'Message Sent' })

  client.sendEmail({ Source: {}, Destination: {}, Message: { Body: { Html: { Data: 'Data' } }, Subject: { Data: 'Data' } } }, function (err, result) {
    let responseBody = JSON.parse(result.data.toString())
    t.equal(responseBody.message, 'Message Sent')
  })
})

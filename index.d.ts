declare module "coap" {
  import { Readable, Writable } from "stream";
  import { RemoteInfo, Socket } from "dgram";
  import { CoapMethod, OptionName, Option, NamedOption } from "coap-packet";

  export interface RequestOption {
    /**
     * A domain name or IP address of the server to issue the request to. Defaults to `'localhost'`.
     */
    host: string;
    /**
     * To support `url.parse()` `hostname` is preferred over `host`
     */
    hostname: string;
    /**
     * Port of remote server. Defaults to 5683.
     */
    port: number;
    /**
     * A string specifying the CoAP request method. Defaults to `'GET'`.
     */
    method: CoapMethod;
    /**
     * Send a CoAP confirmable message (CON), defaults to `true`.
     */
    confirmable: boolean;
    /**
     * Send a CoAP observe message, allowing the streaming of updates from the server.
     */
    observe: boolean;
    /**
     * Request path. Defaults to `'/'`. Should not include query string.
     */
    pathname: string;
    /**
     * Query string. Defaults to `''`. Should not include the path. e.g. 'a=b&c=d'
     */
    query: string;
    /**
     * Object that includes the CoAP options, for each key-value pair the `setOption()` will be called.
     */
    options: object;
    /**
     * Alias for `options`, but it works only if `options` is missing.
     */
    headers: object;
    /**
     * Controls `Agent` behavior. Possible values:
     * * `undefined` (default): use `globalAgent`, a single socket for all concurrent requests.
     * * `Agent` object: explicitly use the passed in `Agent`.
     * * `false`: opts out of socket reuse with an `Agent`, each request uses a new UDP socket.
     */
    agent: undefined | Agent | false;
    /**
     * Adds the Proxy-Uri option to the request,
     * so if the request is sent to a proxy (or a server with proxy features) the request will be forwarded to the selected URI.
     * The expected value is the URI of the target. E.g.: 'coap://192.168.5.13:6793'
     */
    proxyUri: string;
    /**
     * If set to `true`, it forces request to be multicast.
     * Several `response` events will be emitted for each received response.
     * It's user's responsibility to set proper multicast `host` parameter in request configuration.
     * Default `false`.
     */
    multicast: boolean;
    /**
     * Time to wait for multicast reponses in milliseconds.
     * It is only applicable in case if `multicast` is `true`. Default `20000 ms`.
     */
    multicastTimeout: number;
    /**
     * Overwrite the default maxRetransmit, useful when you want to use a custom retry count for a request
     */
    retrySend: number;
  }

  /**
   * Execute a CoAP request.
   * @param url A string or an object. If it is a string, it is parsed using `require('url').parse(url)`.
   */
  export function request<T extends string | Partial<RequestOption>>(
    url: T
  ): T extends { observe: true } ? ObserveReadStream : OutgoingMessage;

  export interface CreateServerOption {
    /**
     * Indicates if the server should create IPv4 connections (`udp4`) or IPv6 connections (`udp6`).
     * Defaults to `udp4`.
     */
    type: "udp4" | "udp6";
    /**
     * Indicates that the server should behave like a proxy for incoming requests containing the `Proxy-Uri` header.
     * An example of how the proxy feature works, refer to the example in the `/examples` folder. Defaults to `false`.
     */
    proxy: boolean;
    /**
     * Optional. Use this in order to force server to listen on multicast address.
     */
    multicastAddress: string;
    /**
     * Optional. Use this in order to force server to listen on multicast interface.
     * This is only applicable if `multicastAddress` is set.
     * If absent, server will try to listen `multicastAddress` on all available interfaces.
     */
    multicastInterface: string;
    /**
     * Set the number of milliseconds to wait for a piggyback response. Default 50.
     */
    piggybackReplyMs: number;
    /**
     * Optional. Use this to suppress sending ACK messages for non-confirmable packages.
     */
    sendAcksForNonConfirmablePackets: boolean;
  }

  /**
   * Returns a new CoAP Server object.
   * The `requestListener` is a function which is automatically added to the `'request'` event.
   * The constructor can be given an optional options object.
   */
  export function createServer(): CoAPServer;
  export function createServer(requestListener: RequestListener): CoAPServer;
  export function createServer(
    options: Partial<CreateServerOption>
  ): CoAPServer;
  export function createServer(
    options: Partial<CreateServerOption>,
    requestListener: RequestListener
  ): CoAPServer;

  export type RequestListener = (
    request: IncomingMessage,
    response: OutgoingMessage | ObserveWriteStream
  ) => void;

  export class CoAPServer {
    /**
     * Emitted each time there is a request. `request` is an instance of `IncomingMessage`
     * and `response` is an instance of `OutgoingMessage`.
     * If the `observe` flag is specified, the `response` variable will return an instance of `ObserveWriteStream`.
     * Each `write(data)` to the stream will cause a new observe message sent to the client.
     */
    on(event: "request", listener: RequestListener): void;
    /**
     * Begin accepting connections on the specified port and hostname.
     * If the hostname is omitted, the server will accept connections directed to any IPv4 or IPv6 address
     * by passing `null` as the address to the underlining socket.
     * To listen to a unix socket, supply a filename instead of port and hostname.
     * A custom socket object can be passed as a `port` parameter.
     * This custom socket must be an instance of `EventEmitter`
     * which emits `message`, `error` and `close` events
     * and implements `send(msg, offset, length, port, address, callback)` function, just like `dgram.Socket`.
     * In such case, the custom socket must be pre-configured manually,
     * i.e. CoAP server will not bind, add multicast groups or do any other configuration.
     * This function is asynchronous.
     */
    listen(port: number): void;
    listen(port: number, callback: (err: Error) => void): void;
    listen(port: number, address: string): void;
    listen(port: number, address: string, callback: (err: Error) => void): void;
    /**
     * Closes the server.
     * This function is synchronous, but it provides an asynchronous callback for convenience.
     */
    close(callback?: (err: Error) => void): void;
  }

  /**
   * An `OutgoingMessage` object is returned by `coap.request` or emitted by the `coap.createServer` `'response'` event.
   * It may be used to access response status, headers and data.
   * It implements the [Writable Stream](http://nodejs.org/api/stream.html#stream_class_stream_writable) interface,
   * as well as the following additional properties, methods and events.
   */
  export class OutgoingMessage extends Writable {
    /**
     * The CoAP code of the message.
     * It is HTTP-compatible, as it can be passed `404`.
     */
    code: number;
    /**
     * (same as message.code)
     */
    statusCode: number;
    /**
     * All the options are in binary format, except for `'Content-Format'`, `'Accept'`, `'Max-Age'` and `'ETag'`.
     * See `registerOption` to know how to register more.
     * Use an array of buffers if you need to send multiple options with the same name.
     * If you need to pass a custom option, pass a string containing a number as key and a `Buffer` as value.
     * Example: `message.setOption("Content-Format", "application/json");` or `message.setOption("555", [new Buffer('abcde'),new Buffer('ghi')]);`
     * `setOption` is also aliased as `setHeader` for HTTP API compatibility.
     * Also, `'Content-Type'` is aliased to `'Content-Format'` for HTTP compatibility.
     * Since v0.7.0, this library supports blockwise transfers,
     * you can trigger them by adding a `req.setOption('Block2', new Buffer([0x2]))` to the output of `request`.
     * See the [spec](http://tools.ietf.org/html/draft-ietf-core-coap-18#section-5.4) for all the possible options.
     */
    setOption(
      name: string | OptionName,
      value: string | Buffer | Buffer[]
    ): void;
    /**
     * Returns a Reset COAP Message to the sender.
     * The RST message will appear as an empty message with code `0.00` and the reset flag set to `true` to the caller.
     * This action ends the interaction with the caller.
     */
    reset(): void;
    /**
     * Functions somewhat like `http`'s `writeHead()` function.
     * If `code` is does not match the CoAP code mask of `#.##`, it is coerced into this mask.
     * `headers` is an object with keys being the header names, and values being the header values.
     */
    writeHead(code: string, headers: any): void;
    /**
     * Emitted when the request does not receive a response or acknowledgement within a transaction lifetime.
     * `Error` object with message `No reply in XXXs` and `retransmitTimeout` property is provided as a parameter.
     */
    on(event: "timeout", listener: (err: Error) => void): this;
    /**
     * Emitted when an error occurs.
     * This can be due to socket error, confirmable message timeout or any other generic error.
     * `Error` object is provided, that describes the error.
     */
    on(event: "error", listener: (err: Error) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
  }

  /**
   * An `IncomingMessage` object is created by `coap.createServer` or `coap.request`
   * and passed as the first argument to the `'request'` and `'response'` event respectively.
   * It may be used to access response status, headers and data.
   * It implements the [Readable Stream](http://nodejs.org/api/stream.html#stream_class_stream_readable) interface,
   * as well as the following additional methods and properties.
   */
  export class IncomingMessage extends Readable {
    /**
     * The full payload of the message, as a Buffer.
     */
    payload: Buffer;
    /**
     * All the CoAP options, as parsed by [CoAP-packet](http://github.com/mcollina/coap-packet).
     * All the options are in binary format, except for `'Content-Format'`, `'Accept'` and `'ETag'`.
     * See `registerOption()` to know how to register more.
     * See the [spec](http://tools.ietf.org/html/draft-ietf-core-coap-18#section-5.4) for all the possible options.
     */
    options: (Option | NamedOption)[];
    /**
     * All the CoAP options that can be represented in a human-readable format.
     * Currently they are only `'Content-Format'`, `'Accept'` and `'ETag'`.
     * See `registerOption` to know how to register more.
     * Also, `'Content-Type'` is aliased to `'Content-Format'` for HTTP compatibility.
     */
    headers: object;
    /**
     * The CoAP code of the message.
     */
    code: number;
    /**
     * The method of the message, it might be `'GET'`, `'POST'`, `'PUT'`, `'DELETE'` or `null`.
     * It is null if the CoAP code cannot be parsed into a method, i.e. it is not in the '0.' range.
     */
    method: CoapMethod | null;
    /**
     * The URL of the request, e.g. `'coap://localhost:12345/hello/world?a=b&b=c'`.
     */
    url: string;
    /**
     * The sender informations, as emitted by the socket.
     * See [the `dgram` docs](http://nodejs.org/api/dgram.html#dgram_event_message) for details
     */
    rsinfo: RemoteInfo;
    /**
     * Information about the socket used for the communication (address and port).
     */
    outSocket: Socket;
  }

  /**
   * An `ObserveReadStream` object is created by `coap.request` to handle _observe_ requests.
   * It is passed as the first argument to the `'response'` event.
   * It may be used to access response status, headers and data as they are sent by the server.
   * __Each new observe message from the server is a new `'data'` event__.
   * It implements the [Readable Stream](http://nodejs.org/api/stream.html#stream_class_stream_readable)
   * and `IncomingMessage` interfaces, as well as the following additional methods, events and properties.
   */
  export class ObserveReadStream extends IncomingMessage {
    /**
     * Closes the stream.
     */
    close(): void;
    /**
     * The sender informations, as emitted by the socket.
     * See [the `dgram` docs](http://nodejs.org/api/dgram.html#dgram_event_message) for details
     */
    rsinfo: RemoteInfo;
    /**
     * Information about the socket used for the communication (address and port).
     */
    outSocket: Socket;
  }

  /**
   * An `ObserveWriteStream` object is emitted by the `coap.createServer` `'response'` event as a response object.
   * It may be used to set response status, headers and stream changing data to the client.
   * Each new `write()` call is a __new message__ being sent to the client.
   * It implements the [Writable Stream](http://nodejs.org/api/stream.html#stream_class_stream_writable)
   * and `OutgoingMessage` interfaces, as well as the following additional methods and properties.
   */
  export class ObserveWriteStream extends OutgoingMessage {
    /**
     * Emitted when the client is not sending 'acks' anymore for the sent messages.
     */
    on(event: "finish", listener: (err: Error) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    /**
     * Returns a Reset COAP Message to the sender.
     * The RST message will appear as an empty message with code `0.00` and the reset flag set to `true` to the caller.
     * This action ends the interaction with the caller.
     */
    reset(): void;
  }

  /**
   * Register a new option to be converted to string and added to the `message.headers`.
   */
  export function registerOption(
    name: string,
    toBinary: (str: string) => Buffer,
    toString: (buf: Buffer) => string
  ): void;

  /**
   * Explicitly ignore an option; useful for compatibility with `http`-based modules.
   */
  export function ignoreOption(name: string): void;

  /**
   * Register a new format to be interpreted and sent in CoAP `Content-Format` option.
   * Each format is identified by a number, see the [Content-Format registry](http://tools.ietf.org/html/draft-ietf-core-coap-18#section-12.3).
   * These are the defaults formats:
   * ```js
   * registerFormat('text/plain', 0)
   * registerFormat('application/link-format', 40)
   * registerFormat('application/xml', 41)
   * registerFormat('application/octet-stream', 42)
   * registerFormat('application/exi', 47)
   * registerFormat('application/json', 50)
   * ```
   */
  export function registerFormat(name: string, value: number): void;

  export interface AgentOption {
    /**
     * `'udp4'` or `'udp6'` if we want an Agent on an IPv4 or IPv6 UDP socket.
     */
    type: "udp4" | "udp6";
    /**
     * Use existing socket instead of creating a new one.
     */
    socket: Socket;
  }

  /**
   * An Agent encapsulate an UDP Socket.
   * It uses a combination of `messageId` and `token` to distinguish between the different exchanges.
   * The socket will auto-close itself when no more exchange are in place.
   * By default, no UDP socket are open, and it is opened on demand to send the messages.
   */
  export class Agent {
    constructor(options?: Partial<AgentOption>);
  }

  /**
   * The default `Agent` for IPv4.
   */
  export const globalAgent: Agent;

  /**
   * The default `Agent` for IPv6.
   */
  export const globalAgentIPv6: Agent;

  export interface CoAPParameter {
    /**
     * ACK timeout in seconds
     * @default 2
     */
    ackTimeout: number;
    /**
     * @default 1.5
     */
    ackRandomFactor: number;
    /**
     * @default 4
     */
    maxRetransmit: number;
    /**
     * Maximum time a datagram is expected to take
     * from the start of its transmission to the completion of its reception (in seconds).
     * @default 100
     */
    maxLatency: number;
    /**
     * @default 50
     */
    piggybackReplyMs: number;
    /**
     * Default CoAP port
     * @default 5683
     */
    coapPort: number;
    /**
     * Default max packet size
     * @default 1280
     */
    maxPacketSize: number;
    /**
     * If `true`, always send CoAP ACK messages, even for non confirmabe packets.
     * else, only send CoAP ACK messages for confirmabe packets
     * @default true
     */
    sendAcksForNonConfirmablePackets: boolean;
  }

  /**
   * You can update the CoAP timing settings, take a look at the examples:
   * ```js
   * var coapTiming = {
   *   ackTimeout:0.25,
   *   ackRandomFactor: 1.0,
   *   maxRetransmit: 3,
   *   maxLatency: 2,
   *   piggybackReplyMs: 10
   * };
   * coap.updateTiming(coapTiming);
   * ```
   */
  export function updateTiming(parameters: Partial<CoAPParameter>): void;

  /**
   * Reset the CoAP timings to the default values.
   */
  export function defaultTiming(): void;
}

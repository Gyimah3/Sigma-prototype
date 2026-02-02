> ## Documentation Index
> Fetch the complete documentation index at: https://docs.langchain.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Streaming

LangGraph implements a streaming system to surface real-time updates. Streaming is crucial for enhancing the responsiveness of applications built on LLMs. By displaying output progressively, even before a complete response is ready, streaming significantly improves user experience (UX), particularly when dealing with the latency of LLMs.

What's possible with LangGraph streaming:

* <Icon icon="share-nodes" size={16} /> [**Stream graph state**](#stream-graph-state) — get state updates / values with `updates` and `values` modes.
* <Icon icon="square-poll-horizontal" size={16} /> [**Stream subgraph outputs**](#stream-subgraph-outputs) — include outputs from both the parent graph and any nested subgraphs.
* <Icon icon="square-binary" size={16} /> [**Stream LLM tokens**](#messages) — capture token streams from anywhere: inside nodes, subgraphs, or tools.
* <Icon icon="table" size={16} /> [**Stream custom data**](#stream-custom-data) — send custom updates or progress signals directly from tool functions.
* <Icon icon="layer-plus" size={16} /> [**Use multiple streaming modes**](#stream-multiple-modes) — choose from `values` (full state), `updates` (state deltas), `messages` (LLM tokens + metadata), `custom` (arbitrary user data), or `debug` (detailed traces).

## Supported stream modes

Pass one or more of the following stream modes as a list to the [`stream`](https://reference.langchain.com/python/langgraph/graphs/#langgraph.graph.state.CompiledStateGraph.stream) or [`astream`](https://reference.langchain.com/python/langgraph/graphs/#langgraph.graph.state.CompiledStateGraph.astream) methods:

| Mode       | Description                                                                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `values`   | Streams the full value of the state after each step of the graph.                                                                                                                   |
| `updates`  | Streams the updates to the state after each step of the graph. If multiple updates are made in the same step (e.g., multiple nodes are run), those updates are streamed separately. |
| `custom`   | Streams custom data from inside your graph nodes.                                                                                                                                   |
| `messages` | Streams 2-tuples (LLM token, metadata) from any graph nodes where an LLM is invoked.                                                                                                |
| `debug`    | Streams as much information as possible throughout the execution of the graph.                                                                                                      |

## Basic usage example

LangGraph graphs expose the [`stream`](https://reference.langchain.com/python/langgraph/pregel/#langgraph.pregel.Pregel.stream) (sync) and [`astream`](https://reference.langchain.com/python/langgraph/pregel/#langgraph.pregel.Pregel.astream) (async) methods to yield streamed outputs as iterators.

```python  theme={null}
for chunk in graph.stream(inputs, stream_mode="updates"):
    print(chunk)
```

<Accordion title="Extended example: streaming updates">
  ```python  theme={null}
  from typing import TypedDict
  from langgraph.graph import StateGraph, START, END

  class State(TypedDict):
      topic: str
      joke: str

  def refine_topic(state: State):
      return {"topic": state["topic"] + " and cats"}

  def generate_joke(state: State):
      return {"joke": f"This is a joke about {state['topic']}"}

  graph = (
      StateGraph(State)
      .add_node(refine_topic)
      .add_node(generate_joke)
      .add_edge(START, "refine_topic")
      .add_edge("refine_topic", "generate_joke")
      .add_edge("generate_joke", END)
      .compile()
  )

  # The stream() method returns an iterator that yields streamed outputs
  for chunk in graph.stream(  # [!code highlight]
      {"topic": "ice cream"},
      # Set stream_mode="updates" to stream only the updates to the graph state after each node
      # Other stream modes are also available. See supported stream modes for details
      stream_mode="updates",  # [!code highlight]
  ):
      print(chunk)
  ```

  ```python  theme={null}
  {'refineTopic': {'topic': 'ice cream and cats'}}
  {'generateJoke': {'joke': 'This is a joke about ice cream and cats'}}
  ```
</Accordion>

## Stream multiple modes

You can pass a list as the `stream_mode` parameter to stream multiple modes at once.

The streamed outputs will be tuples of `(mode, chunk)` where `mode` is the name of the stream mode and `chunk` is the data streamed by that mode.

```python  theme={null}
for mode, chunk in graph.stream(inputs, stream_mode=["updates", "custom"]):
    print(chunk)
```

## Stream graph state

Use the stream modes `updates` and `values` to stream the state of the graph as it executes.

* `updates` streams the **updates** to the state after each step of the graph.
* `values` streams the **full value** of the state after each step of the graph.

```python  theme={null}
from typing import TypedDict
from langgraph.graph import StateGraph, START, END


class State(TypedDict):
  topic: str
  joke: str


def refine_topic(state: State):
    return {"topic": state["topic"] + " and cats"}


def generate_joke(state: State):
    return {"joke": f"This is a joke about {state['topic']}"}

graph = (
  StateGraph(State)
  .add_node(refine_topic)
  .add_node(generate_joke)
  .add_edge(START, "refine_topic")
  .add_edge("refine_topic", "generate_joke")
  .add_edge("generate_joke", END)
  .compile()
)
```

<Tabs>
  <Tab title="updates">
    Use this to stream only the **state updates** returned by the nodes after each step. The streamed outputs include the name of the node as well as the update.

    ```python  theme={null}
    for chunk in graph.stream(
        {"topic": "ice cream"},
        stream_mode="updates",  # [!code highlight]
    ):
        print(chunk)
    ```
  </Tab>

  <Tab title="values">
    Use this to stream the **full state** of the graph after each step.

    ```python  theme={null}
    for chunk in graph.stream(
        {"topic": "ice cream"},
        stream_mode="values",  # [!code highlight]
    ):
        print(chunk)
    ```
  </Tab>
</Tabs>

## Stream subgraph outputs

To include outputs from [subgraphs](/oss/python/langgraph/use-subgraphs) in the streamed outputs, you can set `subgraphs=True` in the `.stream()` method of the parent graph. This will stream outputs from both the parent graph and any subgraphs.

The outputs will be streamed as tuples `(namespace, data)`, where `namespace` is a tuple with the path to the node where a subgraph is invoked, e.g. `("parent_node:<task_id>", "child_node:<task_id>")`.

```python  theme={null}
for chunk in graph.stream(
    {"foo": "foo"},
    # Set subgraphs=True to stream outputs from subgraphs
    subgraphs=True,  # [!code highlight]
    stream_mode="updates",
):
    print(chunk)
```

<Accordion title="Extended example: streaming from subgraphs">
  ```python  theme={null}
  from langgraph.graph import START, StateGraph
  from typing import TypedDict

  # Define subgraph
  class SubgraphState(TypedDict):
      foo: str  # note that this key is shared with the parent graph state
      bar: str

  def subgraph_node_1(state: SubgraphState):
      return {"bar": "bar"}

  def subgraph_node_2(state: SubgraphState):
      return {"foo": state["foo"] + state["bar"]}

  subgraph_builder = StateGraph(SubgraphState)
  subgraph_builder.add_node(subgraph_node_1)
  subgraph_builder.add_node(subgraph_node_2)
  subgraph_builder.add_edge(START, "subgraph_node_1")
  subgraph_builder.add_edge("subgraph_node_1", "subgraph_node_2")
  subgraph = subgraph_builder.compile()

  # Define parent graph
  class ParentState(TypedDict):
      foo: str

  def node_1(state: ParentState):
      return {"foo": "hi! " + state["foo"]}

  builder = StateGraph(ParentState)
  builder.add_node("node_1", node_1)
  builder.add_node("node_2", subgraph)
  builder.add_edge(START, "node_1")
  builder.add_edge("node_1", "node_2")
  graph = builder.compile()

  for chunk in graph.stream(
      {"foo": "foo"},
      stream_mode="updates",
      # Set subgraphs=True to stream outputs from subgraphs
      subgraphs=True,  # [!code highlight]
  ):
      print(chunk)
  ```

  ```
  ((), {'node_1': {'foo': 'hi! foo'}})
  (('node_2:dfddc4ba-c3c5-6887-5012-a243b5b377c2',), {'subgraph_node_1': {'bar': 'bar'}})
  (('node_2:dfddc4ba-c3c5-6887-5012-a243b5b377c2',), {'subgraph_node_2': {'foo': 'hi! foobar'}})
  ((), {'node_2': {'foo': 'hi! foobar'}})
  ```

  **Note** that we are receiving not just the node updates, but we also the namespaces which tell us what graph (or subgraph) we are streaming from.
</Accordion>

<a id="debug" />

### Debugging

Use the `debug` streaming mode to stream as much information as possible throughout the execution of the graph. The streamed outputs include the name of the node as well as the full state.

```python  theme={null}
for chunk in graph.stream(
    {"topic": "ice cream"},
    stream_mode="debug",  # [!code highlight]
):
    print(chunk)
```

<a id="messages" />

## LLM tokens

Use the `messages` streaming mode to stream Large Language Model (LLM) outputs **token by token** from any part of your graph, including nodes, tools, subgraphs, or tasks.

The streamed output from [`messages` mode](#supported-stream-modes) is a tuple `(message_chunk, metadata)` where:

* `message_chunk`: the token or message segment from the LLM.
* `metadata`: a dictionary containing details about the graph node and LLM invocation.

> If your LLM is not available as a LangChain integration, you can stream its outputs using `custom` mode instead. See [use with any LLM](#use-with-any-llm) for details.

<Warning>
  **Manual config required for async in Python \< 3.11**
  When using Python \< 3.11 with async code, you must explicitly pass [`RunnableConfig`](https://reference.langchain.com/python/langchain_core/runnables/#langchain_core.runnables.RunnableConfig) to `ainvoke()` to enable proper streaming. See [Async with Python \< 3.11](#async) for details or upgrade to Python 3.11+.
</Warning>

```python  theme={null}
from dataclasses import dataclass

from langchain.chat_models import init_chat_model
from langgraph.graph import StateGraph, START


@dataclass
class MyState:
    topic: str
    joke: str = ""


model = init_chat_model(model="gpt-4.1-mini")

def call_model(state: MyState):
    """Call the LLM to generate a joke about a topic"""
    # Note that message events are emitted even when the LLM is run using .invoke rather than .stream
    model_response = model.invoke(  # [!code highlight]
        [
            {"role": "user", "content": f"Generate a joke about {state.topic}"}
        ]
    )
    return {"joke": model_response.content}

graph = (
    StateGraph(MyState)
    .add_node(call_model)
    .add_edge(START, "call_model")
    .compile()
)

# The "messages" stream mode returns an iterator of tuples (message_chunk, metadata)
# where message_chunk is the token streamed by the LLM and metadata is a dictionary
# with information about the graph node where the LLM was called and other information
for message_chunk, metadata in graph.stream(
    {"topic": "ice cream"},
    stream_mode="messages",  # [!code highlight]
):
    if message_chunk.content:
        print(message_chunk.content, end="|", flush=True)
```

#### Filter by LLM invocation

You can associate `tags` with LLM invocations to filter the streamed tokens by LLM invocation.

```python  theme={null}
from langchain.chat_models import init_chat_model

# model_1 is tagged with "joke"
model_1 = init_chat_model(model="gpt-4.1-mini", tags=['joke'])
# model_2 is tagged with "poem"
model_2 = init_chat_model(model="gpt-4.1-mini", tags=['poem'])

graph = ... # define a graph that uses these LLMs

# The stream_mode is set to "messages" to stream LLM tokens
# The metadata contains information about the LLM invocation, including the tags
async for msg, metadata in graph.astream(
    {"topic": "cats"},
    stream_mode="messages",  # [!code highlight]
):
    # Filter the streamed tokens by the tags field in the metadata to only include
    # the tokens from the LLM invocation with the "joke" tag
    if metadata["tags"] == ["joke"]:
        print(msg.content, end="|", flush=True)
```

<Accordion title="Extended example: filtering by tags">
  ```python  theme={null}
  from typing import TypedDict

  from langchain.chat_models import init_chat_model
  from langgraph.graph import START, StateGraph

  # The joke_model is tagged with "joke"
  joke_model = init_chat_model(model="gpt-4.1-mini", tags=["joke"])
  # The poem_model is tagged with "poem"
  poem_model = init_chat_model(model="gpt-4.1-mini", tags=["poem"])


  class State(TypedDict):
        topic: str
        joke: str
        poem: str


  async def call_model(state, config):
        topic = state["topic"]
        print("Writing joke...")
        # Note: Passing the config through explicitly is required for python < 3.11
        # Since context var support wasn't added before then: https://docs.python.org/3/library/asyncio-task.html#creating-tasks
        # The config is passed through explicitly to ensure the context vars are propagated correctly
        # This is required for Python < 3.11 when using async code. Please see the async section for more details
        joke_response = await joke_model.ainvoke(
              [{"role": "user", "content": f"Write a joke about {topic}"}],
              config,
        )
        print("\n\nWriting poem...")
        poem_response = await poem_model.ainvoke(
              [{"role": "user", "content": f"Write a short poem about {topic}"}],
              config,
        )
        return {"joke": joke_response.content, "poem": poem_response.content}


  graph = (
        StateGraph(State)
        .add_node(call_model)
        .add_edge(START, "call_model")
        .compile()
  )

  # The stream_mode is set to "messages" to stream LLM tokens
  # The metadata contains information about the LLM invocation, including the tags
  async for msg, metadata in graph.astream(
        {"topic": "cats"},
        stream_mode="messages",
  ):
      if metadata["tags"] == ["joke"]:
          print(msg.content, end="|", flush=True)
  ```
</Accordion>

#### Filter by node

To stream tokens only from specific nodes, use `stream_mode="messages"` and filter the outputs by the `langgraph_node` field in the streamed metadata:

```python  theme={null}
# The "messages" stream mode returns a tuple of (message_chunk, metadata)
# where message_chunk is the token streamed by the LLM and metadata is a dictionary
# with information about the graph node where the LLM was called and other information
for msg, metadata in graph.stream(
    inputs,
    stream_mode="messages",  # [!code highlight]
):
    # Filter the streamed tokens by the langgraph_node field in the metadata
    # to only include the tokens from the specified node
    if msg.content and metadata["langgraph_node"] == "some_node_name":
        ...
```

<Accordion title="Extended example: streaming LLM tokens from specific nodes">
  ```python  theme={null}
  from typing import TypedDict
  from langgraph.graph import START, StateGraph
  from langchain_openai import ChatOpenAI

  model = ChatOpenAI(model="gpt-4.1-mini")


  class State(TypedDict):
        topic: str
        joke: str
        poem: str


  def write_joke(state: State):
        topic = state["topic"]
        joke_response = model.invoke(
              [{"role": "user", "content": f"Write a joke about {topic}"}]
        )
        return {"joke": joke_response.content}


  def write_poem(state: State):
        topic = state["topic"]
        poem_response = model.invoke(
              [{"role": "user", "content": f"Write a short poem about {topic}"}]
        )
        return {"poem": poem_response.content}


  graph = (
        StateGraph(State)
        .add_node(write_joke)
        .add_node(write_poem)
        # write both the joke and the poem concurrently
        .add_edge(START, "write_joke")
        .add_edge(START, "write_poem")
        .compile()
  )

  # The "messages" stream mode returns a tuple of (message_chunk, metadata)
  # where message_chunk is the token streamed by the LLM and metadata is a dictionary
  # with information about the graph node where the LLM was called and other information
  for msg, metadata in graph.stream(
      {"topic": "cats"},
      stream_mode="messages",  # [!code highlight]
  ):
      # Filter the streamed tokens by the langgraph_node field in the metadata
      # to only include the tokens from the write_poem node
      if msg.content and metadata["langgraph_node"] == "write_poem":
          print(msg.content, end="|", flush=True)
  ```
</Accordion>

## Stream custom data

To send **custom user-defined data** from inside a LangGraph node or tool, follow these steps:

1. Use [`get_stream_writer`](https://reference.langchain.com/python/langgraph/config/#langgraph.config.get_stream_writer) to access the stream writer and emit custom data.
2. Set `stream_mode="custom"` when calling `.stream()` or `.astream()` to get the custom data in the stream. You can combine multiple modes (e.g., `["updates", "custom"]`), but at least one must be `"custom"`.

<Warning>
  **No [`get_stream_writer`](https://reference.langchain.com/python/langgraph/config/#langgraph.config.get_stream_writer) in async for Python \< 3.11**
  In async code running on Python \< 3.11, [`get_stream_writer`](https://reference.langchain.com/python/langgraph/config/#langgraph.config.get_stream_writer) will not work.
  Instead, add a `writer` parameter to your node or tool and pass it manually.
  See [Async with Python \< 3.11](#async) for usage examples.
</Warning>

<Tabs>
  <Tab title="node">
    ```python  theme={null}
    from typing import TypedDict
    from langgraph.config import get_stream_writer
    from langgraph.graph import StateGraph, START

    class State(TypedDict):
        query: str
        answer: str

    def node(state: State):
        # Get the stream writer to send custom data
        writer = get_stream_writer()
        # Emit a custom key-value pair (e.g., progress update)
        writer({"custom_key": "Generating custom data inside node"})
        return {"answer": "some data"}

    graph = (
        StateGraph(State)
        .add_node(node)
        .add_edge(START, "node")
        .compile()
    )

    inputs = {"query": "example"}

    # Set stream_mode="custom" to receive the custom data in the stream
    for chunk in graph.stream(inputs, stream_mode="custom"):
        print(chunk)
    ```
  </Tab>

  <Tab title="tool">
    ```python  theme={null}
    from langchain.tools import tool
    from langgraph.config import get_stream_writer

    @tool
    def query_database(query: str) -> str:
        """Query the database."""
        # Access the stream writer to send custom data
        writer = get_stream_writer()  # [!code highlight]
        # Emit a custom key-value pair (e.g., progress update)
        writer({"data": "Retrieved 0/100 records", "type": "progress"})  # [!code highlight]
        # perform query
        # Emit another custom key-value pair
        writer({"data": "Retrieved 100/100 records", "type": "progress"})
        return "some-answer"


    graph = ... # define a graph that uses this tool

    # Set stream_mode="custom" to receive the custom data in the stream
    for chunk in graph.stream(inputs, stream_mode="custom"):
        print(chunk)
    ```
  </Tab>
</Tabs>

## Use with any LLM

You can use `stream_mode="custom"` to stream data from **any LLM API** — even if that API does **not** implement the LangChain chat model interface.

This lets you integrate raw LLM clients or external services that provide their own streaming interfaces, making LangGraph highly flexible for custom setups.

```python  theme={null}
from langgraph.config import get_stream_writer

def call_arbitrary_model(state):
    """Example node that calls an arbitrary model and streams the output"""
    # Get the stream writer to send custom data
    writer = get_stream_writer()  # [!code highlight]
    # Assume you have a streaming client that yields chunks
    # Generate LLM tokens using your custom streaming client
    for chunk in your_custom_streaming_client(state["topic"]):
        # Use the writer to send custom data to the stream
        writer({"custom_llm_chunk": chunk})  # [!code highlight]
    return {"result": "completed"}

graph = (
    StateGraph(State)
    .add_node(call_arbitrary_model)
    # Add other nodes and edges as needed
    .compile()
)
# Set stream_mode="custom" to receive the custom data in the stream
for chunk in graph.stream(
    {"topic": "cats"},
    stream_mode="custom",  # [!code highlight]

):
    # The chunk will contain the custom data streamed from the llm
    print(chunk)
```

<Accordion title="Extended example: streaming arbitrary chat model">
  ```python  theme={null}
  import operator
  import json

  from typing import TypedDict
  from typing_extensions import Annotated
  from langgraph.graph import StateGraph, START

  from openai import AsyncOpenAI

  openai_client = AsyncOpenAI()
  model_name = "gpt-4.1-mini"


  async def stream_tokens(model_name: str, messages: list[dict]):
      response = await openai_client.chat.completions.create(
          messages=messages, model=model_name, stream=True
      )
      role = None
      async for chunk in response:
          delta = chunk.choices[0].delta

          if delta.role is not None:
              role = delta.role

          if delta.content:
              yield {"role": role, "content": delta.content}


  # this is our tool
  async def get_items(place: str) -> str:
      """Use this tool to list items one might find in a place you're asked about."""
      writer = get_stream_writer()
      response = ""
      async for msg_chunk in stream_tokens(
          model_name,
          [
              {
                  "role": "user",
                  "content": (
                      "Can you tell me what kind of items "
                      f"i might find in the following place: '{place}'. "
                      "List at least 3 such items separating them by a comma. "
                      "And include a brief description of each item."
                  ),
              }
          ],
      ):
          response += msg_chunk["content"]
          writer(msg_chunk)

      return response


  class State(TypedDict):
      messages: Annotated[list[dict], operator.add]


  # this is the tool-calling graph node
  async def call_tool(state: State):
      ai_message = state["messages"][-1]
      tool_call = ai_message["tool_calls"][-1]

      function_name = tool_call["function"]["name"]
      if function_name != "get_items":
          raise ValueError(f"Tool {function_name} not supported")

      function_arguments = tool_call["function"]["arguments"]
      arguments = json.loads(function_arguments)

      function_response = await get_items(**arguments)
      tool_message = {
          "tool_call_id": tool_call["id"],
          "role": "tool",
          "name": function_name,
          "content": function_response,
      }
      return {"messages": [tool_message]}


  graph = (
      StateGraph(State)
      .add_node(call_tool)
      .add_edge(START, "call_tool")
      .compile()
  )
  ```

  Let's invoke the graph with an [`AIMessage`](https://reference.langchain.com/python/langchain/messages/#langchain.messages.AIMessage) that includes a tool call:

  ```python  theme={null}
  inputs = {
      "messages": [
          {
              "content": None,
              "role": "assistant",
              "tool_calls": [
                  {
                      "id": "1",
                      "function": {
                          "arguments": '{"place":"bedroom"}',
                          "name": "get_items",
                      },
                      "type": "function",
                  }
              ],
          }
      ]
  }

  async for chunk in graph.astream(
      inputs,
      stream_mode="custom",
  ):
      print(chunk["content"], end="|", flush=True)
  ```
</Accordion>

## Disable streaming for specific chat models

If your application mixes models that support streaming with those that do not, you may need to explicitly disable streaming for
models that do not support it.

Set `streaming=False` when initializing the model.

<Tabs>
  <Tab title="init_chat_model">
    ```python  theme={null}
    from langchain.chat_models import init_chat_model

    model = init_chat_model(
        "claude-sonnet-4-5-20250929",
        # Set streaming=False to disable streaming for the chat model
        streaming=False  # [!code highlight]
    )
    ```
  </Tab>

  <Tab title="Chat model interface">
    ```python  theme={null}
    from langchain_openai import ChatOpenAI

    # Set streaming=False to disable streaming for the chat model
    model = ChatOpenAI(model="o1-preview", streaming=False)
    ```
  </Tab>
</Tabs>

<Note>
  Not all chat model integrations support the `streaming` parameter. If your model doesn't support it, use `disable_streaming=True` instead. This parameter is available on all chat models via the base class.
</Note>

<a id="async" />

### Async with Python \< 3.11

In Python versions \< 3.11, [asyncio tasks](https://docs.python.org/3/library/asyncio-task.html#asyncio.create_task) do not support the `context` parameter.
This limits LangGraph ability to automatically propagate context, and affects LangGraph's streaming mechanisms in two key ways:

1. You **must** explicitly pass [`RunnableConfig`](https://python.langchain.com/docs/concepts/runnables/#runnableconfig) into async LLM calls (e.g., `ainvoke()`), as callbacks are not automatically propagated.
2. You **cannot** use [`get_stream_writer`](https://reference.langchain.com/python/langgraph/config/#langgraph.config.get_stream_writer) in async nodes or tools — you must pass a `writer` argument directly.

<Accordion title="Extended example: async LLM call with manual config">
  ```python  theme={null}
  from typing import TypedDict
  from langgraph.graph import START, StateGraph
  from langchain.chat_models import init_chat_model

  model = init_chat_model(model="gpt-4.1-mini")

  class State(TypedDict):
      topic: str
      joke: str

  # Accept config as an argument in the async node function
  async def call_model(state, config):
      topic = state["topic"]
      print("Generating joke...")
      # Pass config to model.ainvoke() to ensure proper context propagation
      joke_response = await model.ainvoke(  # [!code highlight]
          [{"role": "user", "content": f"Write a joke about {topic}"}],
          config,
      )
      return {"joke": joke_response.content}

  graph = (
      StateGraph(State)
      .add_node(call_model)
      .add_edge(START, "call_model")
      .compile()
  )

  # Set stream_mode="messages" to stream LLM tokens
  async for chunk, metadata in graph.astream(
      {"topic": "ice cream"},
      stream_mode="messages",  # [!code highlight]
  ):
      if chunk.content:
          print(chunk.content, end="|", flush=True)
  ```
</Accordion>

<Accordion title="Extended example: async custom streaming with stream writer">
  ```python  theme={null}
  from typing import TypedDict
  from langgraph.types import StreamWriter

  class State(TypedDict):
        topic: str
        joke: str

  # Add writer as an argument in the function signature of the async node or tool
  # LangGraph will automatically pass the stream writer to the function
  async def generate_joke(state: State, writer: StreamWriter):  # [!code highlight]
        writer({"custom_key": "Streaming custom data while generating a joke"})
        return {"joke": f"This is a joke about {state['topic']}"}

  graph = (
        StateGraph(State)
        .add_node(generate_joke)
        .add_edge(START, "generate_joke")
        .compile()
  )

  # Set stream_mode="custom" to receive the custom data in the stream  # [!code highlight]
  async for chunk in graph.astream(
        {"topic": "ice cream"},
        stream_mode="custom",
  ):
        print(chunk)
  ```
</Accordion>

***

<Callout icon="pen-to-square" iconType="regular">
  [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/streaming.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).
</Callout>

<Tip icon="terminal" iconType="regular">
  [Connect these docs](/use-these-docs) to Claude, VSCode, and more via MCP for real-time answers.
</Tip>



Graphs
 StateGraph ¶
Bases: Generic[StateT, ContextT, InputT, OutputT]

A graph whose nodes communicate by reading and writing to a shared state.

The signature of each node is State -> Partial<State>.

Each state key can optionally be annotated with a reducer function that will be used to aggregate the values of that key received from multiple nodes. The signature of a reducer function is (Value, Value) -> Value.

Warning

StateGraph is a builder class and cannot be used directly for execution. You must first call .compile() to create an executable graph that supports methods like invoke(), stream(), astream(), and ainvoke(). See the CompiledStateGraph documentation for more details.

PARAMETER	DESCRIPTION
state_schema	The schema class that defines the state.
TYPE: type[StateT]

context_schema	The schema class that defines the runtime context.
Use this to expose immutable context data to your nodes, like user_id, db_conn, etc.

TYPE: type[ContextT] | NoneDEFAULT: None

input_schema	The schema class that defines the input to the graph.
TYPE: type[InputT] | NoneDEFAULT: None

output_schema	The schema class that defines the output from the graph.
TYPE: type[OutputT] | NoneDEFAULT: None

config_schema Deprecated

The config_schema parameter is deprecated in v0.6.0 and support will be removed in v2.0.0. Please use context_schema instead to specify the schema for run-scoped context.

Example

from langchain_core.runnables import RunnableConfig
from typing_extensions import Annotated, TypedDict
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import StateGraph
from langgraph.runtime import Runtime


def reducer(a: list, b: int | None) -> list:
    if b is not None:
        return a + [b]
    return a


class State(TypedDict):
    x: Annotated[list, reducer]


class Context(TypedDict):
    r: float


graph = StateGraph(state_schema=State, context_schema=Context)


def node(state: State, runtime: Runtime[Context]) -> dict:
    r = runtime.context.get("r", 1.0)
    x = state["x"][-1]
    next_value = x * r * (1 - x)
    return {"x": next_value}


graph.add_node("A", node)
graph.set_entry_point("A")
graph.set_finish_point("A")
compiled = graph.compile()

step1 = compiled.invoke({"x": 0.5}, context={"r": 3.0})
# {'x': [0.5, 0.75]}
METHOD	DESCRIPTION
add_node	Add a new node to the StateGraph.
add_edge	Add a directed edge from the start node (or list of start nodes) to the end node.
add_conditional_edges	Add a conditional edge from the starting node to any number of destination nodes.
add_sequence	Add a sequence of nodes that will be executed in the provided order.
compile	Compiles the StateGraph into a CompiledStateGraph object.
 add_node ¶

add_node(
    node: str | StateNode[NodeInputT, ContextT],
    action: StateNode[NodeInputT, ContextT] | None = None,
    *,
    defer: bool = False,
    metadata: dict[str, Any] | None = None,
    input_schema: type[NodeInputT] | None = None,
    retry_policy: RetryPolicy | Sequence[RetryPolicy] | None = None,
    cache_policy: CachePolicy | None = None,
    destinations: dict[str, str] | tuple[str, ...] | None = None,
    **kwargs: Unpack[DeprecatedKwargs],
) -> Self
Add a new node to the StateGraph.

PARAMETER	DESCRIPTION
node	The function or runnable this node will run.
If a string is provided, it will be used as the node name, and action will be used as the function or runnable.

TYPE: str | StateNode[NodeInputT, ContextT]

action	The action associated with the node.
Will be used as the node function or runnable if node is a string (node name).

TYPE: StateNode[NodeInputT, ContextT] | NoneDEFAULT: None

defer	Whether to defer the execution of the node until the run is about to end.
TYPE: boolDEFAULT: False

metadata	The metadata associated with the node.
TYPE: dict[str, Any] | NoneDEFAULT: None

input_schema	The input schema for the node. (Default: the graph's state schema)
TYPE: type[NodeInputT] | NoneDEFAULT: None

retry_policy	The retry policy for the node.
If a sequence is provided, the first matching policy will be applied.

TYPE: RetryPolicy | Sequence[RetryPolicy] | NoneDEFAULT: None

cache_policy	The cache policy for the node.
TYPE: CachePolicy | NoneDEFAULT: None

destinations	Destinations that indicate where a node can route to.
Useful for edgeless graphs with nodes that return Command objects.

If a dict is provided, the keys will be used as the target node names and the values will be used as the labels for the edges.

If a tuple is provided, the values will be used as the target node names.

Warning

This is only used for graph rendering and doesn't have any effect on the graph execution.

TYPE: dict[str, str] | tuple[str, ...] | NoneDEFAULT: None

Example

from typing_extensions import TypedDict

from langchain_core.runnables import RunnableConfig
from langgraph.graph import START, StateGraph


class State(TypedDict):
    x: int


def my_node(state: State, config: RunnableConfig) -> State:
    return {"x": state["x"] + 1}


builder = StateGraph(State)
builder.add_node(my_node)  # node name will be 'my_node'
builder.add_edge(START, "my_node")
graph = builder.compile()
graph.invoke({"x": 1})
# {'x': 2}
Customize the name:

builder = StateGraph(State)
builder.add_node("my_fair_node", my_node)
builder.add_edge(START, "my_fair_node")
graph = builder.compile()
graph.invoke({"x": 1})
# {'x': 2}
RETURNS	DESCRIPTION
Self	The instance of the StateGraph, allowing for method chaining.
TYPE: Self

 add_edge ¶

add_edge(start_key: str | list[str], end_key: str) -> Self
Add a directed edge from the start node (or list of start nodes) to the end node.

When a single start node is provided, the graph will wait for that node to complete before executing the end node. When multiple start nodes are provided, the graph will wait for ALL of the start nodes to complete before executing the end node.

PARAMETER	DESCRIPTION
start_key	The key(s) of the start node(s) of the edge.
TYPE: str | list[str]

end_key	The key of the end node of the edge.
TYPE: str

RAISES	DESCRIPTION
ValueError	If the start key is 'END' or if the start key or end key is not present in the graph.
RETURNS	DESCRIPTION
Self	The instance of the StateGraph, allowing for method chaining.
TYPE: Self

 add_conditional_edges ¶

add_conditional_edges(
    source: str,
    path: Callable[..., Hashable | Sequence[Hashable]]
    | Callable[..., Awaitable[Hashable | Sequence[Hashable]]]
    | Runnable[Any, Hashable | Sequence[Hashable]],
    path_map: dict[Hashable, str] | list[str] | None = None,
) -> Self
Add a conditional edge from the starting node to any number of destination nodes.

PARAMETER	DESCRIPTION
source	The starting node. This conditional edge will run when exiting this node.
TYPE: str

path	The callable that determines the next node or nodes.
If not specifying path_map it should return one or more nodes.

If it returns 'END', the graph will stop execution.

TYPE: Callable[..., Hashable | Sequence[Hashable]] | Callable[..., Awaitable[Hashable | Sequence[Hashable]]] | Runnable[Any, Hashable | Sequence[Hashable]]

path_map	Optional mapping of paths to node names.
If omitted the paths returned by path should be node names.

TYPE: dict[Hashable, str] | list[str] | NoneDEFAULT: None

RETURNS	DESCRIPTION
Self	The instance of the graph, allowing for method chaining.
TYPE: Self

Warning

Without type hints on the path function's return value (e.g., -> Literal["foo", "__end__"]:) or a path_map, the graph visualization assumes the edge could transition to any node in the graph.

 add_sequence ¶

add_sequence(
    nodes: Sequence[
        StateNode[NodeInputT, ContextT] | tuple[str, StateNode[NodeInputT, ContextT]]
    ],
) -> Self
Add a sequence of nodes that will be executed in the provided order.

PARAMETER	DESCRIPTION
nodes	A sequence of StateNode (callables that accept a state arg) or (name, StateNode) tuples.
If no names are provided, the name will be inferred from the node object (e.g. a Runnable or a Callable name).

Each node will be executed in the order provided.

TYPE: Sequence[StateNode[NodeInputT, ContextT] | tuple[str, StateNode[NodeInputT, ContextT]]]

RAISES	DESCRIPTION
ValueError	If the sequence is empty.
ValueError	If the sequence contains duplicate node names.
RETURNS	DESCRIPTION
Self	The instance of the StateGraph, allowing for method chaining.
TYPE: Self

 compile ¶

compile(
    checkpointer: Checkpointer = None,
    *,
    cache: BaseCache | None = None,
    store: BaseStore | None = None,
    interrupt_before: All | list[str] | None = None,
    interrupt_after: All | list[str] | None = None,
    debug: bool = False,
    name: str | None = None,
) -> CompiledStateGraph[StateT, ContextT, InputT, OutputT]
Compiles the StateGraph into a CompiledStateGraph object.

The compiled graph implements the Runnable interface and can be invoked, streamed, batched, and run asynchronously.

PARAMETER	DESCRIPTION
checkpointer	A checkpoint saver object or flag.
If provided, this Checkpointer serves as a fully versioned "short-term memory" for the graph, allowing it to be paused, resumed, and replayed from any point.

If None, it may inherit the parent graph's checkpointer when used as a subgraph.

If False, it will not use or inherit any checkpointer.

Important: When a checkpointer is enabled, you should pass a thread_id in the config when invoking the graph:


config = {"configurable": {"thread_id": "my-thread"}}
graph.invoke(inputs, config)
The thread_id is the key used to store and retrieve checkpoints. Use a unique ID for independent runs, or reuse the same ID to accumulate state across invocations (e.g., for conversation memory).

TYPE: CheckpointerDEFAULT: None

interrupt_before	An optional list of node names to interrupt before.
TYPE: All | list[str] | NoneDEFAULT: None

interrupt_after	An optional list of node names to interrupt after.
TYPE: All | list[str] | NoneDEFAULT: None

debug	A flag indicating whether to enable debug mode.
TYPE: boolDEFAULT: False

name	The name to use for the compiled graph.
TYPE: str | NoneDEFAULT: None

RETURNS	DESCRIPTION
CompiledStateGraph	The compiled StateGraph.
TYPE: CompiledStateGraph[StateT, ContextT, InputT, OutputT]

 CompiledStateGraph ¶
Bases: Pregel[StateT, ContextT, InputT, OutputT], Generic[StateT, ContextT, InputT, OutputT]

METHOD	DESCRIPTION
stream	Stream graph steps for a single input.
astream	Asynchronously stream graph steps for a single input.
invoke	Run the graph with a single input and config.
ainvoke	Asynchronously run the graph with a single input and config.
get_state	Get the current state of the graph.
aget_state	Get the current state of the graph.
get_state_history	Get the history of the state of the graph.
aget_state_history	Asynchronously get the history of the state of the graph.
update_state	Update the state of the graph with the given values, as if they came from
aupdate_state	Asynchronously update the state of the graph with the given values, as if they came from
bulk_update_state	Apply updates to the graph state in bulk. Requires a checkpointer to be set.
abulk_update_state	Asynchronously apply updates to the graph state in bulk. Requires a checkpointer to be set.
get_graph	Return a drawable representation of the computation graph.
aget_graph	Return a drawable representation of the computation graph.
get_subgraphs	Get the subgraphs of the graph.
aget_subgraphs	Get the subgraphs of the graph.
with_config	Create a copy of the Pregel object with an updated config.
 stream ¶

stream(
    input: InputT | Command | None,
    config: RunnableConfig | None = None,
    *,
    context: ContextT | None = None,
    stream_mode: StreamMode | Sequence[StreamMode] | None = None,
    print_mode: StreamMode | Sequence[StreamMode] = (),
    output_keys: str | Sequence[str] | None = None,
    interrupt_before: All | Sequence[str] | None = None,
    interrupt_after: All | Sequence[str] | None = None,
    durability: Durability | None = None,
    subgraphs: bool = False,
    debug: bool | None = None,
    **kwargs: Unpack[DeprecatedKwargs],
) -> Iterator[dict[str, Any] | Any]
Stream graph steps for a single input.

PARAMETER	DESCRIPTION
input	The input to the graph.
TYPE: InputT | Command | None

config	The configuration to use for the run.
TYPE: RunnableConfig | NoneDEFAULT: None

context	The static context to use for the run.
Added in version 0.6.0

TYPE: ContextT | NoneDEFAULT: None

stream_mode	The mode to stream output, defaults to self.stream_mode.
Options are:

"values": Emit all values in the state after each step, including interrupts. When used with functional API, values are emitted once at the end of the workflow.
"updates": Emit only the node or task names and updates returned by the nodes or tasks after each step. If multiple updates are made in the same step (e.g. multiple nodes are run) then those updates are emitted separately.
"custom": Emit custom data from inside nodes or tasks using StreamWriter.
"messages": Emit LLM messages token-by-token together with metadata for any LLM invocations inside nodes or tasks.
Will be emitted as 2-tuples (LLM token, metadata).
"checkpoints": Emit an event when a checkpoint is created, in the same format as returned by get_state().
"tasks": Emit events when tasks start and finish, including their results and errors.
"debug": Emit debug events with as much information as possible for each step.
You can pass a list as the stream_mode parameter to stream multiple modes at once. The streamed outputs will be tuples of (mode, data).

See LangGraph streaming guide for more details.

TYPE: StreamMode | Sequence[StreamMode] | NoneDEFAULT: None

print_mode	Accepts the same values as stream_mode, but only prints the output to the console, for debugging purposes.
Does not affect the output of the graph in any way.

TYPE: StreamMode | Sequence[StreamMode]DEFAULT: ()

output_keys	The keys to stream, defaults to all non-context channels.
TYPE: str | Sequence[str] | NoneDEFAULT: None

interrupt_before	Nodes to interrupt before, defaults to all nodes in the graph.
TYPE: All | Sequence[str] | NoneDEFAULT: None

interrupt_after	Nodes to interrupt after, defaults to all nodes in the graph.
TYPE: All | Sequence[str] | NoneDEFAULT: None

durability	The durability mode for the graph execution, defaults to "async".
Options are:

"sync": Changes are persisted synchronously before the next step starts.
"async": Changes are persisted asynchronously while the next step executes.
"exit": Changes are persisted only when the graph exits.
TYPE: Durability | NoneDEFAULT: None

subgraphs	Whether to stream events from inside subgraphs, defaults to False.
If True, the events will be emitted as tuples (namespace, data), or (namespace, mode, data) if stream_mode is a list, where namespace is a tuple with the path to the node where a subgraph is invoked, e.g. ("parent_node:<task_id>", "child_node:<task_id>").

See LangGraph streaming guide for more details.

TYPE: boolDEFAULT: False

YIELDS	DESCRIPTION
dict[str, Any] | Any	The output of each step in the graph. The output shape depends on the stream_mode.
 astream async ¶

astream(
    input: InputT | Command | None,
    config: RunnableConfig | None = None,
    *,
    context: ContextT | None = None,
    stream_mode: StreamMode | Sequence[StreamMode] | None = None,
    print_mode: StreamMode | Sequence[StreamMode] = (),
    output_keys: str | Sequence[str] | None = None,
    interrupt_before: All | Sequence[str] | None = None,
    interrupt_after: All | Sequence[str] | None = None,
    durability: Durability | None = None,
    subgraphs: bool = False,
    debug: bool | None = None,
    **kwargs: Unpack[DeprecatedKwargs],
) -> AsyncIterator[dict[str, Any] | Any]
Asynchronously stream graph steps for a single input.

PARAMETER	DESCRIPTION
input	The input to the graph.
TYPE: InputT | Command | None

config	The configuration to use for the run.
TYPE: RunnableConfig | NoneDEFAULT: None

context	The static context to use for the run.
Added in version 0.6.0

TYPE: ContextT | NoneDEFAULT: None

stream_mode	The mode to stream output, defaults to self.stream_mode.
Options are:

"values": Emit all values in the state after each step, including interrupts. When used with functional API, values are emitted once at the end of the workflow.
"updates": Emit only the node or task names and updates returned by the nodes or tasks after each step. If multiple updates are made in the same step (e.g. multiple nodes are run) then those updates are emitted separately.
"custom": Emit custom data from inside nodes or tasks using StreamWriter.
"messages": Emit LLM messages token-by-token together with metadata for any LLM invocations inside nodes or tasks.
Will be emitted as 2-tuples (LLM token, metadata).
"checkpoints": Emit an event when a checkpoint is created, in the same format as returned by get_state().
"tasks": Emit events when tasks start and finish, including their results and errors.
"debug": Emit debug events with as much information as possible for each step.
You can pass a list as the stream_mode parameter to stream multiple modes at once. The streamed outputs will be tuples of (mode, data).

See LangGraph streaming guide for more details.

TYPE: StreamMode | Sequence[StreamMode] | NoneDEFAULT: None

print_mode	Accepts the same values as stream_mode, but only prints the output to the console, for debugging purposes.
Does not affect the output of the graph in any way.

TYPE: StreamMode | Sequence[StreamMode]DEFAULT: ()

output_keys	The keys to stream, defaults to all non-context channels.
TYPE: str | Sequence[str] | NoneDEFAULT: None

interrupt_before	Nodes to interrupt before, defaults to all nodes in the graph.
TYPE: All | Sequence[str] | NoneDEFAULT: None

interrupt_after	Nodes to interrupt after, defaults to all nodes in the graph.
TYPE: All | Sequence[str] | NoneDEFAULT: None

durability	The durability mode for the graph execution, defaults to "async".
Options are:

"sync": Changes are persisted synchronously before the next step starts.
"async": Changes are persisted asynchronously while the next step executes.
"exit": Changes are persisted only when the graph exits.
TYPE: Durability | NoneDEFAULT: None

subgraphs	Whether to stream events from inside subgraphs, defaults to False.
If True, the events will be emitted as tuples (namespace, data), or (namespace, mode, data) if stream_mode is a list, where namespace is a tuple with the path to the node where a subgraph is invoked, e.g. ("parent_node:<task_id>", "child_node:<task_id>").

See LangGraph streaming guide for more details.

TYPE: boolDEFAULT: False

YIELDS	DESCRIPTION
AsyncIterator[dict[str, Any] | Any]


FASTAPI STREAMING SUPPORT EXAMPLE

        async def stream_model_response() -> AsyncGenerator[str, None]:
            async for stream in engine.astream_events(
                {"messages": [("human", input_body.message)]},
                version="v2",
                config={"configurable": {"thread_id": thread_id}},
            ):
                event = stream.get("event")
                if event == "on_chat_model_stream":
                    chunk = stream.get("data", {}).get("chunk")
                    if chunk and (content := getattr(chunk, "content", None)):
                        content_str = str(content)
                        if (content_str.strip().startswith("{") and 
                            any(keyword in content_str for keyword in ["intent", "rephrased", "confidence"])):
                            continue
                        
                        if isinstance(content, list):
                            if content and isinstance(content[0], dict) and "text" in content[0]:
                                yield json.dumps({"stream": str(content[0]["text"])}) + "\n"
                            elif not (content and isinstance(content[0], dict) and content[0].get("type") == "tool_use"):
                                yield json.dumps({"stream": str(content)}) + "\n"
                        else:
                            yield json.dumps({"stream": content}) + "\n"
                elif event == "on_retriever_end":
                    results = stream.get("data", {}).get("output", [])
                    used = []
                    for r in results:
                        if hasattr(r, "page_content"):
                            used.append({"page_content": r.page_content, "metadata": getattr(r, "metadata", {})})
                        elif isinstance(r, dict):
                            used.append(r)
                        else:
                            used.append({"content": str(r)})
                    yield json.dumps({"used_docs": used}) + "\n"

        return StreamingResponse(stream_model_response(), media_type="application/x-ndjson")

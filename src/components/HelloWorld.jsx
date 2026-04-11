import { useState } from 'react'

export default function HelloWorld(props) {

  async function requestData() {
    const res = await fetch('https://canvas.qut.edu.au/api/v1/courses?enrollment_state=active&per_page=10', {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });

    console.log(await res.json());

  }

  const [count, setCount] = useState(0)

  return (
    <>
      <h1>{props.msg}</h1>

      <button onClick={requestData}>Request</button>

      <div className="card">
        <button type="button" onClick={() => setCount(count + 1)}>
          count is
          {' '}
          {count}
        </button>
        <p>
          Edit
          <code>src/components/HelloWorld.jsx</code>
          {' '}
          to test HMR
        </p>
      </div>

      <p>
        Check out
        <a href="https://github.com/crxjs/create-crxjs" target="_blank" rel="noreferrer">create-crxjs</a>
        , the official starter
      </p>

      <p className="read-the-docs">
        Click on the Vite, React and CRXJS logos to learn more
      </p>
    </>
  )
}

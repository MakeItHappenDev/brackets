import React, {useState} from 'react'

import styles from './index.module.scss'

const bracketsPool = [0.2, 0.7, 1.7, 3.7, 7.7, 13.7, 20.7, 28.7, 37.7, 47.7, 58.7, 71.5, 85.8, 100]
const bracketsRP = [12000, 11000, 10000, 9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000, 1000, 400, 0]
const bracketsRPMax = [13000, 12000, 11000, 10000, 9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000, 1000, 400]

const RP2rank = (rp) => {
  rp = parseInt(rp)
  let rank = (rp + 10000) / 5000
  if (rp < 2000) {
    rank = 1 + (rp / 2000)
  } else if (rp < 5000) { rank = 2 + ((rp - 2000) / 3000) }
  return Math.floor(rank * 100) / 100
}
const rank2RP = (rank) => {
  rank = parseFloat(rank)
  let RP = (rank * 5000) - 10000
  if (rank < 1) {
    RP = 0
  } else if (rank < 2) {
    RP = (rank - 1) * 2000
  } else if (rank < 3) { RP = 2000 + (rank - 2) * 3000 }
  return Math.floor(RP)
}

function sortByHonor(a,b) {
  if (parseInt(a.thisWeekHonor) > parseInt(b.thisWeekHonor))
    return -1;
  if (parseInt(a.thisWeekHonor) < parseInt(b.thisWeekHonor))
    return 1;
  return 0;
}


export default (props) => {
  const [pool,setPool] = useState(5000)
  const [rank,setRank] = useState(10.0)
  const [honor,setHonor] = useState(1000)
  const [standings,setStandings] = useState(null)
  const [activeRealm,setActiveRealm] = useState("Dummy - faction")

  const loadFromHS = (realm) => {
    setPool(realm.pool)
    setActiveRealm(realm.name)
    console.log(realm)
    setStandings(realm.standings.sort(sortByHonor))
  }

  //If we have standings we can compute standing from honor + RP earned + RP delta + expected rank
  let standing = "N/A"
  if(standings){
    //starting from the bottom, find standing
    let i = standings.length
    let go = true
    while(i > 0 && standings[i-1] && go){
      //find if standings[i] had less honor
      if(standings[i-1].thisWeekHonor > honor){
        go = false
        standing = i+1
      }
      i--
    }
    if(standing === "N/A"){
      standing = 1
    }
  }

  // Calc bracket size/leader/trailers
  let current = 0
  let brackets = []

  for(let i=0;i<bracketsPool.length;i++){

    //Calc leader and trailer
    let leader = Math.floor(pool  * ((bracketsPool[i-1] || 0)/100))
    const trailer = Math.floor(pool * (bracketsPool[i]/100))

    //Calc size of the bracket
    const size = trailer - leader

    //If bracket isn't empty (trailer > last trailer)
    //Add 1 to the leader standing required
    if(trailer > current)
    {
      leader++
      current = trailer
    }

    brackets.push({
      leader: leader,
      trailer:trailer,
      size:size,
      pool:bracketsPool[i],
      minRP:bracketsRP[i],
      maxRP:bracketsRPMax[i]
    })
  }


  //Calc Summary

  //Calc decay
  const currentRP = rank2RP(rank)
  const decay = Math.floor(currentRP * 0.20)

  return (
    <>
      <main className={styles.honor}>
        <section className={styles.form}>
          <label>PoolSize</label>
          <input type="number" value={pool} onChange={e=>setPool(e.target.value)}/>

          <label>Honor</label>
          <input type="number" value={honor} onChange={e=>setHonor(e.target.value)}/>

          <label>Rank</label>
          <input type="number" value={rank} onChange={e=>setRank(e.target.value)} step="0.1"/>
        </section>
        <section className={styles.summary}>
          <p>Realm : {activeRealm}</p>
          <p>Standing : {standing}</p>
          <p>RP earned : N/A</p>
          <p>RP decay : {decay}</p>
          <p>RP delta : N/A</p>
          <p>rank expected : N/A</p>
          {standings && <pre>{JSON.stringify(standings,null,1)}</pre>}
        </section>
        <section className={styles.table}>
          <table>
            <thead>
              <tr>
                <th>Bracket</th>
                <th>%</th>
                <th>Bracket Size</th>
                <th>Br leader</th>
                <th>Br trailer</th>
                <th>RP leader</th>
                <th>RP trailer</th>
              </tr>
            </thead>
            <tbody>
              {brackets.map((b,i)=><Bracket key={`bracket-${i}`} index={i+1} {...b} poolSize={pool}/>)}
            </tbody>
          </table>
        </section>
        <Standings loadFromHS={loadFromHS}/>
      </main>
    </>
  )
}

const Bracket = (props) => {
  return(
    <>
    <tr>
      <td>{props.index}</td>
      <td>{props.pool}%</td>
      <td>{props.size}</td>
      <td>{props.leader}</td>
      <td>{props.trailer}</td>
      <td>{props.maxRP}</td>
      <td>{props.minRP}</td>
    </tr>
    </>
  )
}

//More like transform LUA to JSON kindof
const parseLua = (lua) => {
  //Clear honorspy artefact
  let string = lua.replace('HonorSpyDB = ','')
  string = string.replace('return HonorSpyDB','')
  //Clear ["key"] => "key"
  string = string.replace(/\[/g,'')
  string = string.replace(/\]/g,'')

  //Clear = attribution => :
  string = string.replace(/=/g,':')

  //Remove whitespaces
  string = string.replace(/\s/g,'')

  //Remove trailing commas
  while(string.match(/,}/)){
    string = string.replace(/,}/g,'}')
  }

  return string
}

const keysToArray = (object) => {
  let keys = Object.keys(object)
  let array = []
  for(let i = 0;i<keys.length;i++){
    array.push({...object[keys[i]],name:keys[i]})
  }
  return array
}

const Standings = (props) => {

  const [honorSpy,setHonorSpy] = useState()
  const [parsed, setParsed] = useState(null)

  const handlePaste = (e) => {
    try{
      let lua = parseLua(e.target.value)
      setParsed(JSON.parse(lua).realms)
      setHonorSpy("Copy Successful!")
    }
    catch(e){
      const error = e.toString()
      setHonorSpy("Error! " + error)
      setParsed({error})
    }
  }

  let realms = []
  if(parsed){
    let keys = Object.keys(parsed)
    for(let i = 0;i<keys.length;i++){

      // TODO use standings to calculate honor required
      let standings = []
      if(parsed[keys[i]].hs && parsed[keys[i]].hs.currentStandings){
        standings = keysToArray(parsed[keys[i]].hs.currentStandings)
      }
      realms.push({name:keys[i],pool:standings.length,standings})
    }

  }

  return(
    <section className={styles.standings}>
    <h1>Load infos from your HonorSpy db</h1>
      <textarea value={honorSpy} onChange={e=>handlePaste(e)} placeholder="Copy content of honorspy.lua here"/>
      <button onClick={e=>setHonorSpy('')}>Clear</button>

      <ul>
        {parsed && realms.map(r => <li key={`loadRealm-${r.name}`} onClick={e=>props.loadFromHS(r)}>{r.name} ({r.pool})</li>)}
      </ul>
    </section>
  )
}
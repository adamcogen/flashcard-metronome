/**
 * This file contains the main logic and function definitions for running and updating the sequencer, its on-screen display, etc.
 */

window.onload = () => {

    // Store DOM elements we use, so that we can access them without having to pull them from the DOM each time
    let domElements = {
        divs: {
            drawShapes: document.getElementById('draw-shapes'),
            tempoTextInputs: document.getElementById('tempo-text-inputs'),
            subdivisionTextInputs: document.getElementById('subdivision-text-inputs')
        },
        textInputs: {
            loopLengthMillis: document.getElementById('text-input-loop-length-millis'),
        }
    }

    // Initialize Two.js library
    let two = initializeTwoJs(domElements.divs.drawShapes)

    // initialize sound file constants
    const SOUND_FILES_PATH = './sounds/';
    const HIGH = 'high';
    const MID = 'mid';
    const LOW = 'low';
    const SILENCE = 'silence';
    const WAV_EXTENSION = '.wav';

    // load all sound files
    let samples = {}
    samples[HIGH] = new SequencerNoteType(loadSample(HIGH, SOUND_FILES_PATH + HIGH + WAV_EXTENSION), '#1b617a')
    samples[MID] = new SequencerNoteType(loadSample(MID, SOUND_FILES_PATH + MID + WAV_EXTENSION), '#bd3b07')
    samples[LOW] = new SequencerNoteType(loadSample(LOW, SOUND_FILES_PATH + LOW + WAV_EXTENSION), '#b58f04')
    samples[SILENCE] = new SequencerNoteType(loadSample(SILENCE, SOUND_FILES_PATH + SILENCE + WAV_EXTENSION), 'transparent')

    // initialize the list of sample names we will use. the order of this list determines the order of sounds on the sound bank
    let sampleNameList = [HIGH, MID, SILENCE]

    // initialize ID generator for node / note labels, and node generator for notes taken from the sample bank.
    let idGenerator = new IdGenerator() // we will use this same ID generator everywhere we need IDs, to make sure we track which IDs have already been generated
    let sampleBankNodeGenerator = new SampleBankNodeGenerator(idGenerator, sampleNameList) // generates a new sequencer list node whenever we pull a note off the sound bank

    // initialize web audio context
    setUpAudioAndAnimationForWebAudioApi()
    let audioContext = new AudioContext();

    // wait until the first click before resuming the audio context (this is required by Chrome browser)
    let audioContextStarted = false
    window.onclick = () => {
        if (!audioContextStarted) {
            audioContext.resume()
            audioContextStarted = true
        }
    }

    /**
     * drum machine configurations
     */
    // assume the metronome is starting with 4 beats per loop
    let beatsPerMinute = 120;
    let loopLengthInMillis = convertBeatsPerMinuteToLoopLengthInMillis(beatsPerMinute, 4); // length of the whole drum sequence (loop), in millliseconds
    const LOOK_AHEAD_MILLIS = 200; // number of milliseconds to look ahead when scheduling notes to play. note bigger value means that there is a longer delay for sounds to stop after the 'pause' button is hit.
    /**
     * gui settings: sequencer
     */
    let sequencerVerticalOffset = 100
    let sequencerHorizontalOffset = 150
    let sequencerWidth = 400
    let spaceBetweenSequencerRows = 40
    let timeTrackerHeight = 20
    let unplayedCircleRadius = 10
    let playedCircleRadius = 13
    let smallUnplayedCircleRadius = 6
    let smallPlayedCircleRadius = 9
    /**
     * gui settings: pause button
     */
    let pauseButtonVerticalOffset = 170
    let pauseButtonHorizontalOffset = 150
    let pauseButtonWidth = 48
    let pauseButtonHeight = 48
    /**
     * gui settings: colors
     */
    let sequencerAndToolsLineColor = '#707070'
    let sequencerAndToolsLineWidth = 3
    /**
     * tempo text input settings
     */
    domElements.divs.tempoTextInputs.style.left = "477px"
    domElements.divs.tempoTextInputs.style.top = "25px"
    let minimumAllowedBeatsPerMinute = 20;
    let maximumAllowedBeatsPerMinute = 500;
    /**
     * subdivision text input settings
     */
    let subdivisionTextInputHorizontalPadding = 10
    let subdivisionTextInputVerticalPadding = -17
    let maximumAllowedNumberOfSubdivisions = 1000


    // initialize sequencer data structure
    let sequencer = new Sequencer(2, loopLengthInMillis)
    sequencer.rows[0].setNumberOfSubdivisions(4)
    sequencer.rows[0].setQuantization(true)
    sequencer.rows[1].setNumberOfSubdivisions(1)
    sequencer.rows[1].setQuantization(true)

    // create and store on-screen lines, shapes, etc. (these will be Two.js 'path' objects)
    // let timeTrackerLines = initializeTimeTrackerLines() // list of lines that move to represent the current time within the loop
    let pauseButton = initializePauseButton() // a rectangle that will act as the pause button for now
    let beatsPerMinuteText = initializeBeatsPerMinuteText() // a label next to the 'beats per minute' text input

    two.update(); // this initial 'update' creates SVG '_renderer' properties for our shapes that we can add action listeners to, so it needs to go here

    initializeTempoTextInputValuesAndStyles();
    initializeTempoTextInputActionListeners();

    // start putting together some subdivision text input proof-of-concept stuff here
    let subdivisionTextInputs = []
    initializeSubdivisionTextInputsValuesAndStyles();
    initializeSubdivisionTextInputsActionListeners();

    addPauseButtonActionListeners()

    // create variables which will be used to track info about the note that is being clicked and dragged
    let circleBeingMoved = null
    let circleBeingMovedOldRow = null

    // create constants that denote special 'lastPlayedOnIteration' values
    const NOTE_HAS_NEVER_BEEN_PLAYED = -1

    // set up a initial example drum sequence
    initializeDefaultSequencerPattern()

    // keep a list of all the circles (i.e. notes) that have been drawn on the screen
    let allDrawnCircles = []

    drawNotesToReflectSequencerCurrentState()

    // get the next note that needs to be scheduled for each row (will start as list 'head', and update as we go)
    let nextNoteToScheduleForEachRow = []
    for (let nextNotesInitializedSoFarCount = 0; nextNotesInitializedSoFarCount < sequencer.numberOfRows; nextNotesInitializedSoFarCount++) {
        nextNoteToScheduleForEachRow.push(sequencer.rows[nextNotesInitializedSoFarCount].notesList.head)
    }

    // run any miscellaneous unit tests needed before starting main update loop
    testConfineNumberToBounds()

    // start main recursive update loop, where all state updates will happen
    requestAnimationFrameShim(draw)

    /**
     * initialize some variables that will be used for timekeeping, managing of pauses, etc.
     */
    /**
     * how should time tracking / pausing be managed?
     * how time tracking worked previously, before adding the ability to pause:
     *   - we tracked 'current time' in millis
     *   - we calculated 'start time of current loop': Math.floor('current time' / 'loop length')
     *   - we know the time at which each note should play within the loop, so if a note
     *     needed to play, we scheduled it for its real time:
     *     'start time of current loop' + 'time this note should play within loop'
     * how should time work, if we want to be able to pause?
     * the tricky thing is that we want to unpause from wherever we paused (i.e. could need to resume half way through a loop), and still have the scheduler work correctly.
     *   - we track 'current time' in millis
     *   - we track 'most recent unpause time'
     *   - we track 'most recent pause-time within loop' (as in, whether most recent pause happened half way thru a loop, towards the end of it, etc., but in millis)
     *   - we calculate 'current time within current loop', account for all the pause-related stuff we tracking (see the code below for how)
     *   - we calculate 'theoretical start time of current loop, calculating for pauses': basically just 'actual current time' - 'current time within current loop'
     *   - once we have 'theoretical start time of current loop' and 'current time within current loop', we have enough info to schedule notes exactly the way we did
     *     before, and pausing / unpausing will be account for. we can also do little things like tell the scheduler to run only if the sequencer is unpaused, etc.
     */
    let currentTime = 0 // current time since audio context was started, in millis
    let mostRecentUnpauseTime = 0 // raw time in millis for when we most recently unpaused the sequencer
    let mostRecentPauseTimeWithinLoop = 0 // when we last paused, how far into the loop were we? as in, if we paused half way thru a loop, this will be millis representing half way thru the loop
    let currentTimeWithinCurrentLoop = 0 // how many millis into the current loop are we?
    let theoreticalStartTimeOfCurrentLoop = 0 // calculate what time the current loop started at (or would have started at in theory, if we account for pauses)
    let paused = false // store whether sequencer is paused or not

    /**
     * end of main logic, start of function definitions.
     */

    // this method is the 'update' loop that will keep updating the page. after first invocation, this method basically calls itself recursively forever.
    function draw() {
        currentTime = audioContext.currentTime * 1000;

        if (paused) {
            currentTimeWithinCurrentLoop = mostRecentPauseTimeWithinLoop // updated for the sake of the on-screen time-tracker lines
        } else {
            currentTimeWithinCurrentLoop = (currentTime - mostRecentUnpauseTime + mostRecentPauseTimeWithinLoop) % loopLengthInMillis
            theoreticalStartTimeOfCurrentLoop = (currentTime - currentTimeWithinCurrentLoop) // no need to update if we are currently paused
        }

        timeTrackersXPosition = sequencerHorizontalOffset + (sequencerWidth * (currentTimeWithinCurrentLoop / loopLengthInMillis))
        currentBeatWithinLoop = Math.floor(currentTimeWithinCurrentLoop / (loopLengthInMillis / sequencer.rows[0].getNumberOfSubdivisions()))

        // draw time tracker lines (lines that follow along each row with time)
        // for (let timeTrackerLine of timeTrackerLine) {
        //     timeTrackerLine.position.x = timeTrackersXPosition
        // }

        // make circles get bigger when they play.
        for (let circle of allDrawnCircles) {
            if (circle.translation.x <= timeTrackersXPosition - 15 || circle.translation.x >= timeTrackersXPosition + 15) {
                if (circle.guiData.row == 0) {
                    circle.radius = unplayedCircleRadius
                } else {
                    circle.radius = smallUnplayedCircleRadius
                }
            } else {
                if (circle.guiData.row == 0) {
                    circle.radius = playedCircleRadius
                } else {
                    circle.radius = smallPlayedCircleRadius
                }
            }
        }

        // iterate through each sequencer, scheduling upcoming notes for all of them
        if (!paused) {
            for (let sequencerRowIndex = 0; sequencerRowIndex < sequencer.numberOfRows; sequencerRowIndex++) {
                if (nextNoteToScheduleForEachRow[sequencerRowIndex] === null) {
                    // if nextNoteToSchedule is null, the list was empty at some point, so keep polling for a note to be added to it.
                    // or we reached the last note, which is fine, just go back to the beginning of the sequence.
                    nextNoteToScheduleForEachRow[sequencerRowIndex] = sequencer.rows[sequencerRowIndex].notesList.head
                }
    
                if (nextNoteToScheduleForEachRow[sequencerRowIndex] !== null) { // will always be null if the row's note list is empty
                    nextNoteToScheduleForEachRow[sequencerRowIndex] = scheduleNotesForCurrentTime(nextNoteToScheduleForEachRow[sequencerRowIndex], sequencerRowIndex, currentTime, currentTimeWithinCurrentLoop, theoreticalStartTimeOfCurrentLoop)
                }
            }
        }

        two.update() // update the GUI display
        requestAnimationFrameShim(draw); // call animation frame update with this 'draw' method again
    }

    function scheduleNotesForCurrentTime(nextNoteToSchedule, sequencerRowIndex, currentTime, currentTimeWithinCurrentLoop, actualStartTimeOfCurrentLoop) {
        let numberOfLoopsSoFar = Math.floor(currentTime / loopLengthInMillis) // mostly used to make sure we don't schedule the same note twice. this number doesn't account for pauses, but i think that's fine. todo: make sure that's fine

        /**
         * At the end of the loop sequence, the look-ahead window may wrap back around to the beginning of the loop.
         * e.g. if there are 3 millis left in the loop, and the look-ahead window is 10 millis long, we will want to schedule
         * all notes that fall in the last 3 millis of the loop, as well as in the first 7 millis.
         * For this reason, scheduling notes will be broken into two steps:
         * (1) schedule notes from current time to the end of look-ahead window or to the end of the loop, whichever comes first
         * (2) if the look-ahead window wraps back around to the beginning of the loop, schedule notes from the beginning of 
         *     the loop to the end of the look-ahead window.
         * This also means the look-ahead window won't work right if the length of the loop is shorter than the look-ahead time,
         * but that is an easy restriction to add, and also if look-ahead window is short (such as 10 millis), we won't want to
         * make a loop shorter than 10 millis anyway, so no one will notice or care about that restriction.
         */
        // this will be the first part: schedule notes from the current time, to whichever of these comes first:
        //   - the end of the look-ahead window
        //   - the end of the loop
        let endTimeOfNotesToSchedule = currentTimeWithinCurrentLoop + LOOK_AHEAD_MILLIS // no need to trim this to the end of the loop, since there won't be any notes scheduled after the end anyway
        // keep iterating until the end of the list (nextNoteToSchedule will be 'null') or until nextNoteToSchedule is after 'end of notes to schedule'
        // what should we do if nextNoteToSchedule is _before_ 'beginning of notes to schedule'?
        while (nextNoteToSchedule !== null && nextNoteToSchedule.priority <= endTimeOfNotesToSchedule) {
            // keep iterating through notes and scheduling them as long as they are within the timeframe to schedule notes for.
            // don't schedule a note unless it hasn't been scheduled on this loop iteration and it goes after the current time (i.e. don't schedule notes in the past, just skip over them)
            if (nextNoteToSchedule.priority >= currentTimeWithinCurrentLoop && numberOfLoopsSoFar > nextNoteToSchedule.data.lastScheduledOnIteration) {
                scheduleDrumSample(actualStartTimeOfCurrentLoop + nextNoteToSchedule.priority, nextNoteToSchedule.data.sampleName)
                nextNoteToSchedule.data.lastScheduledOnIteration = numberOfLoopsSoFar // record the last iteration that the note was played on to avoid duplicate scheduling within the same iteration
            }
            nextNoteToSchedule = nextNoteToSchedule.next
        }

        // this will be the second part: if the look-ahead window went past the end of the loop, schedule notes from the beginning
        // of the loop to the end of leftover look-ahead window time.
        let endTimeToScheduleUpToFromBeginningOfLoop = endTimeOfNotesToSchedule - loopLengthInMillis // calulate leftover time to schedule for from beginning of loop, e.g. from 0 to 7 millis from above example
        let actualStartTimeOfNextLoop = actualStartTimeOfCurrentLoop + loopLengthInMillis
        let numberOfLoopsSoFarPlusOne = numberOfLoopsSoFar + 1
        if (endTimeToScheduleUpToFromBeginningOfLoop >= 0) {
            nextNoteToSchedule = sequencer.rows[sequencerRowIndex].notesList.head
            while (nextNoteToSchedule !== null && nextNoteToSchedule.priority <= endTimeToScheduleUpToFromBeginningOfLoop) {
                // keep iterating through notes and scheduling them as long as they are within the timeframe to schedule notes for
                if (numberOfLoopsSoFarPlusOne > nextNoteToSchedule.data.lastScheduledOnIteration) {
                    scheduleDrumSample(actualStartTimeOfNextLoop + nextNoteToSchedule.priority, nextNoteToSchedule.data.sampleName)
                    nextNoteToSchedule.data.lastScheduledOnIteration = numberOfLoopsSoFarPlusOne
                }
                nextNoteToSchedule = nextNoteToSchedule.next
            }
        }
        return nextNoteToSchedule
    }

    function scheduleDrumSample(startTime, sampleName){
        scheduleSound(samples[sampleName].file, startTime / 1000, .5)
    }

    // schedule a sample to play at the specified time
    function scheduleSound(sample, time, gain=1, playbackRate=1) {
        let sound = audioContext.createBufferSource(); // creates a sound source
        sound.buffer = sample; // tell the sound source which sample to play
        sound.playbackRate.value = playbackRate; // 1 is default playback rate; 0.5 is half-speed; 2 is double-speed

        // set gain (volume). 1 is default, .1 is 10 percent
        gainNode = audioContext.createGain();
        gainNode.gain.value = gain;
        gainNode.connect(audioContext.destination);
        sound.connect(gainNode); // connect the sound to the context's destination (the speakers)

        sound.start(time);
    }

    // play the sample with the given name right away (don't worry about scheduling it for some time in the future)
    function playDrumSampleNow(sampleName) {
        playSoundNow(samples[sampleName].file, .5)
    }

    function playSoundNow(sample, gain=1, playbackRate=1) {
        let sound = audioContext.createBufferSource(); // creates a sound source
        sound.buffer = sample; // tell the sound source which sample to play
        sound.playbackRate.value = playbackRate; // 1 is default playback rate; 0.5 is half-speed; 2 is double-speed

        // set gain (volume). 1 is default, .1 is 10 percent
        gainNode = audioContext.createGain();
        gainNode.gain.value = gain;
        gainNode.connect(audioContext.destination);
        sound.connect(gainNode); // connect the sound to the context's destination (the speakers)

        sound.start();
    }

    // load a sample from a file. to load from a local file, this script needs to be running on a server.
    function loadSample(sampleName, url) {
        let request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';
      
        // Decode asynchronously
        request.onload = function() {
            audioContext.decodeAudioData(request.response, function(buffer) {
            samples[sampleName].file = buffer; // once we get a response, write the returned data to the corresponding attribute in our 'samples' object
          }, (error) => {
              console.log("Error caught when attempting to load file with URL: '" + url + "'. Error: '" + error + "'.")
          });
        }
        request.send();
    }

    function convertBeatsPerMinuteToLoopLengthInMillis(beatsPerMinute, numberOfBeatsPerLoop) {
        let secondsPerMinute = 60
        let millisecondsPerSecond = 1000
        // had to write out some dimensional analysis to figure out how to calculate this..
        return (secondsPerMinute * millisecondsPerSecond * numberOfBeatsPerLoop) / beatsPerMinute
    }

    function convertLoopLengthInMillisToBeatsPerMinute(loopLengthInMillis, numberOfBeatsPerLoop) {
        let secondsPerMinute = 60
        let millisecondsPerSecond = 1000
        return (secondsPerMinute * millisecondsPerSecond * numberOfBeatsPerLoop) / loopLengthInMillis
    }

    // set up a default initial drum sequence with some notes in it
    function initializeDefaultSequencerPattern(){
        sequencer.rows[0].notesList.insertNode(new PriorityLinkedListNode(idGenerator.getNextId(), 0, 
        {
            lastScheduledOnIteration: NOTE_HAS_NEVER_BEEN_PLAYED,
            sampleName: HIGH,
            beat: 0,
        }));
        sequencer.rows[0].notesList.insertNode(new PriorityLinkedListNode(idGenerator.getNextId(), (loopLengthInMillis / 4) * 1, 
        {
            lastScheduledOnIteration: NOTE_HAS_NEVER_BEEN_PLAYED,
            sampleName: MID,
            beat: 1,
        }));
        sequencer.rows[0].notesList.insertNode(new PriorityLinkedListNode(idGenerator.getNextId(), (loopLengthInMillis / 4) * 2, 
        {
            lastScheduledOnIteration: NOTE_HAS_NEVER_BEEN_PLAYED,
            sampleName: MID,
            beat: 2,
        }));
        sequencer.rows[0].notesList.insertNode(new PriorityLinkedListNode(idGenerator.getNextId(), (loopLengthInMillis / 4) * 3, 
        {
            lastScheduledOnIteration: NOTE_HAS_NEVER_BEEN_PLAYED,
            sampleName: MID,
            beat: 3,
        }));
    }

    // initialize Two.js library object and append it to the given DOM element
    function initializeTwoJs(twoJsDomElement) {
        return new Two({
            fullscreen: true,
            type: Two.Types.svg
        }).appendTo(twoJsDomElement);
    }

    // set up AudioContext and requestAnimationFrame, so that they will work nicely
    // with the 'AudioContextMonkeyPatch.js' library. contents of this method were 
    // taken and adjusted from the 'Web Audio Metronome' repo by cwilso on GitHub: 
    // https://github.com/cwilso/metronome
    function setUpAudioAndAnimationForWebAudioApi() {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        
        // Shim the requestAnimationFrame API, with a setTimeout fallback
        window.requestAnimationFrameShim = (function(){
            return window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.oRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            function(callback){
                window.setTimeout(callback, 1000 / 60);
            };
        })();
    }

    function drawNotesToReflectSequencerCurrentState(){
        // draw all notes that are in the sequencer before the sequencer starts (aka the notes of the initial example drum sequence)
        for(let sequencerRowIndex = 0; sequencerRowIndex < sequencer.numberOfRows; sequencerRowIndex++) {
            let noteToDraw = sequencer.rows[sequencerRowIndex].notesList.head
            while (noteToDraw !== null) {
                let xPosition = sequencerHorizontalOffset + (sequencerWidth * (noteToDraw.priority / sequencer.loopLengthInMillis))
                let yPosition = sequencerVerticalOffset + (sequencerRowIndex * spaceBetweenSequencerRows)
                let sampleName = noteToDraw.data.sampleName
                let row = sequencerRowIndex
                let label = noteToDraw.label
                let beat = noteToDraw.data.beat
                drawNewNoteCircle(xPosition, yPosition, sampleName, label, row, beat)
                noteToDraw = noteToDraw.next
            }
        }
    }

    // create a new circle (i.e. note) on the screen, with the specified x and y position. color is determined by sample name. 
    // values given for sample name, label, and row number are stored in the circle object to help the GUI keep track of things.
    // add the newly created circle to the list of all drawn cricles.
    function drawNewNoteCircle(xPosition, yPosition, sampleName, label, row, beat) {
        // initialize the new circle and set its colors
        let newCircleRadius = unplayedCircleRadius;
        if (row != 0) {
            newCircleRadius = smallPlayedCircleRadius;
        }
        let circle = two.makeCircle(xPosition, yPosition, newCircleRadius)
        circle.fill = samples[sampleName].color
        circle.stroke = 'black'
        circle.linewidth = 2

        // add mouse events to the new circle
        two.update() // this 'update' needs to go here because it is what generates the new circle's _renderer.elem 
        
        // add border to circle on mouseover
        circle._renderer.elem.addEventListener('mouseenter', (event) => {
            circle.linewidth = 4
        });
        // remove border from circle when mouse is no longer over it
        circle._renderer.elem.addEventListener('mouseleave', (event) => {
            circle.linewidth = 2
        });
        // if we click a circle, it's sample / color will change to the next one. clicking many times will flip through the sample list over and over.
        // note that one of our samples that we flip through is silence, with a transparent color. 
        circle._renderer.elem.addEventListener('mousedown', (event) => {
            circleBeingMoved = circle
            circleBeingMovedOldRow = circleBeingMoved.guiData.row
            // playDrumSampleNow(circleBeingMoved.guiData.sampleName)

            /**
             * delete the circle (so we can add a new one with a different sample)
             */

            // removeCircleFromDisplay(circleBeingMoved.guiData.label) // remove the circle from the list of all drawn circles and from the two.js canvas
            // if the deleted note is the 'next note to schedule', we should increment that 'next note to schedule' to its .next (i.e. we should skip the deleted note)
            if (nextNoteToScheduleForEachRow[circleBeingMoved.guiData.row] !== null && nextNoteToScheduleForEachRow[circleBeingMoved.guiData.row].label ===  circleBeingMoved.guiData.label) {
                nextNoteToScheduleForEachRow[circleBeingMoved.guiData.row] = nextNoteToScheduleForEachRow[circleBeingMoved.guiData.row].next
            }

            /**
             * we need to update 'next note to schedule' here in the following case: if 'next note to schedule' is the moved note.
             * if we didn't specifically handle this case, then if 'next note to schedule' was the moved note, it would still play.
             * this may not seem bad at first, but the old (removed) note has a null .next value, so the rest of the notes in the 
             * old row would no longer play if we didn't fix this.
             * a fix is to set 'next note to schedule' to its .next if the next note's label matches the removed note's label,
             * _before_ removing the moved note from its old row.
             */
            if (nextNoteToScheduleForEachRow[circleBeingMovedOldRow] !== null && nextNoteToScheduleForEachRow[circleBeingMovedOldRow].label === circleBeingMoved.guiData.label) {
                nextNoteToScheduleForEachRow[circleBeingMovedOldRow] = nextNoteToScheduleForEachRow[circleBeingMovedOldRow].next
            }
            deletedNode = sequencer.rows[circleBeingMovedOldRow].notesList.removeNode(circleBeingMoved.guiData.label)

            /**
             * add a new circle, which will be in the same place as the one we just deleted, but will have a different sameple / color than the deleted one
             */

            nextSampleInListName = sampleNameList[(sampleNameList.indexOf(circleBeingMoved.guiData.sampleName) + 1) % sampleNameList.length]
            circleBeingMoved.guiData.sampleName = nextSampleInListName
            circleBeingMoved.fill = samples[nextSampleInListName].color

            // create a new node for the sample that this note bank circle was for. note bank circles have a sample in their GUI data, 
            // but no real node that can be added to the drum sequencer's data structure, so we need to create one.
            newNode = sampleBankNodeGenerator.createNewNodeForSample(nextSampleInListName)
            circleBeingMoved.guiData.label = newNode.label // the newly generated node will also have a real generated ID (label), use that
            newNode.priority = deletedNode.priority
            // add the moved note to its new sequencer row
            sequencer.rows[circleBeingMovedOldRow].notesList.insertNode(newNode, circleBeingMoved.guiData.label)
            /**
             * we need to update 'next note to schedule' here in the following case:
             * [current time] -> [inserted note] -> ['next note to schedule']
             * if we didn't specifcally handle this case, we wouldn't play the newly inserted node.
             * a way to fix is to call 'next note to schedule' .prev if .prev.label === inserted node .label.
             */
            if (nextNoteToScheduleForEachRow[circleBeingMovedOldRow] !== null && nextNoteToScheduleForEachRow[circleBeingMovedOldRow].previous !== null && nextNoteToScheduleForEachRow[circleBeingMovedOldRow].previous.label === circleBeingMoved.guiData.label) {
                nextNoteToScheduleForEachRow[circleBeingMovedOldRow] = nextNoteToScheduleForEachRow[circleBeingMovedOldRow].previous
            }
            newNode.data.lastScheduledOnIteration = NOTE_HAS_NEVER_BEEN_PLAYED // mark note as 'not played yet on current iteration'
            newNode.data.beat = deletedNode.data.beat
            circleBeingMoved.guiData.beat = deletedNode.data.beat
            circleBeingMoved = null
        });

        // add info to the circle object that the gui uses to keep track of things
        circle.guiData = {}
        circle.guiData.sampleName = sampleName
        circle.guiData.row = row
        circle.guiData.label = label
        circle.guiData.beat = beat

        // add circle to list of all drawn circles
        allDrawnCircles.push(circle)
    }

    // remove a circle from the 'allDrawnCircles' list and two.js canvas, based on its label.
    // this is meant to be used during deletion of notes from the sequencer, with the idea being that deleting
    // them from this list and maybe from a few other places will clear up clutter, and hopefully allow the 
    // deleted circles to get garbage-collected.
    // note that this method _only_ deletes circles from the _display_, not from the underlying sequencer data
    // structure, that needs to be handled somewhere else separately.
    function removeCircleFromDisplay(label){
        let indexOfListItemToRemove = allDrawnCircles.findIndex(elementFromList => elementFromList.guiData.label === label);
        if (indexOfListItemToRemove === -1) { //  we don't expect to reach this case, where a circle with the given label isn't found in the list
            throw "unexpected problem: couldn't find the circle with the given label in the list of all drawn circles, when trying to delete it. the given label was: " + label + ". full list (labels only): " + allDrawnCircles.map((item) => item.guiData.label) + "."
        }
        let listOfOneRemovedElement = allDrawnCircles.splice(indexOfListItemToRemove, 1) // this should go in and delete the element we want to delete!
        if (listOfOneRemovedElement.length !== 1) {
            throw "unexpected problem: we expected exactly one circle to be removed from the allDrawnCricles list, but some other number of circles were removed. number removed: " + listOfOneRemovedElement.length
        }
        // now we should remove the circle from the two.js canvas as well
        listOfOneRemovedElement[0].remove()
    }

    /**
     * remove all circles from the display.
     * this has _no effect_ on the underlying sequencer data structure, it only removes circles _from the GUI display_.
     */
    function removeAllCirclesFromDisplay() {
        let allDrawnCirclesCopy = [...allDrawnCircles] // make a copy of the drawn circles list so we can iterate through its circles while also removing the items from the original list
        for (let note of allDrawnCirclesCopy) {
            removeCircleFromDisplay(note.guiData.label)
        }
    }

    // draw lines for the 'time trackers' for each sequencer row.
    // these are the little lines above each sequencer line that track the current time within the loop.
    // return a list of the drawn lines. these will be Two.js 'path' objects.
    function initializeTimeTrackerLines() {
        let timeTrackerLines = []
        for (let timeTrackersDrawn = 0; timeTrackersDrawn < sequencer.numberOfRows; timeTrackersDrawn++) {
            let trackerLine = two.makePath(
                [
                    new Two.Anchor(sequencerHorizontalOffset, sequencerVerticalOffset + 1 + (timeTrackersDrawn * spaceBetweenSequencerRows)),
                    new Two.Anchor(sequencerHorizontalOffset, sequencerVerticalOffset - timeTrackerHeight + (timeTrackersDrawn * spaceBetweenSequencerRows)),
                ], 
                false
            );
            trackerLine.linewidth = sequencerAndToolsLineWidth;
            trackerLine.stroke = sequencerAndToolsLineColor
    
            timeTrackerLines.push(trackerLine)
        }
        return timeTrackerLines
    }

    function initializeBeatsPerMinuteText() {
        beatsPerMinuteLabelText = new Two.Text("Beats per minute: ", 390, 45);
        beatsPerMinuteLabelText.fill = "black";
        // beatsPerMinuteLabelText.stroke = "white";
        beatsPerMinuteLabelText.size = 20;
        two.add(beatsPerMinuteLabelText);
        return beatsPerMinuteLabelText
    }

    function initializePauseButton() {
        let pauseButton = two.makePath(
            [
                new Two.Anchor(pauseButtonHorizontalOffset, pauseButtonVerticalOffset),
                new Two.Anchor(pauseButtonHorizontalOffset + pauseButtonWidth, pauseButtonVerticalOffset),
                new Two.Anchor(pauseButtonHorizontalOffset + pauseButtonWidth, pauseButtonVerticalOffset + pauseButtonHeight),
                new Two.Anchor(pauseButtonHorizontalOffset, pauseButtonVerticalOffset + pauseButtonHeight),
            ],
            false
        );
        pauseButton.linewidth = sequencerAndToolsLineWidth
        pauseButton.stroke = sequencerAndToolsLineColor
        pauseButton.fill = 'transparent'
        return pauseButton
    }

    function addPauseButtonActionListeners() {
        pauseButton._renderer.elem.addEventListener('click', (event) => {
            togglePaused()
        })
    }

    // toggle whether the sequencer is 'paused' or not. this method gets called when we click the pause button
    function togglePaused() {
        if (paused) { // unpause 
            unpause()
        } else { // pause
            pause()
        }
    }

    function pause() {
        if (!paused) {
            paused = true
            mostRecentPauseTimeWithinLoop = currentTimeWithinCurrentLoop
            pauseButton.fill = "#bfbfbf"
        }
    }

    function unpause() {
        if (paused) {
            paused = false
            mostRecentUnpauseTime = currentTime
            pauseButton.fill = "transparent"
        }
    }

    // restart the sequence, as in move the time tracker lines back to the beginning of the sequence, etc.
    function restartSequencer() {
        mostRecentPauseTimeWithinLoop = 0
        for (let nextNoteToScheduleForRow of nextNoteToScheduleForEachRow) {
            nextNoteToScheduleForRow = null // reset next note to schedule. 'head' will get picked up on the next call to draw() 
        }
    }

    function initializeTempoTextInputValuesAndStyles() {
        domElements.textInputs.loopLengthMillis.value = beatsPerMinute
        domElements.textInputs.loopLengthMillis.style.borderColor = sequencerAndToolsLineColor
    }

    function initializeTempoTextInputActionListeners() {
        /**
         * set up 'focus' and 'blur' events for the 'loop length in millis' text input.
         * the plan is that when you update the values in the text box, they will be applied
         * after you click away from the text box automaticaly, unless the input isn't a valid
         * number. if something besides a valid number is entered, the value will just go back
         * to whatever it was before, and not make any change to the sequencer.
         */
        domElements.textInputs.loopLengthMillis.addEventListener('blur', (event) => {
            let newTextInputValue = domElements.textInputs.loopLengthMillis.value.trim() // remove whitespace from beginning and end of input then store it
            if (newTextInputValue === "" || isNaN(newTextInputValue)) { // check if new input is a real number. if not, switch input box back to whatever value it had before.
                newTextInputValue = beatsPerMinute
            }
            newTextInputValue = parseFloat(newTextInputValue) // do we allow floats rather than ints?? i think we could. it probably barely makes a difference though
            // don't allow setting loop length shorter than the look-ahead length or longer than the width of the text input
            newTextInputValue = confineNumberToBounds(newTextInputValue, minimumAllowedBeatsPerMinute, maximumAllowedBeatsPerMinute)
            domElements.textInputs.loopLengthMillis.value = newTextInputValue
            updateSequencerLoopLength(convertBeatsPerMinuteToLoopLengthInMillis(newTextInputValue, sequencer.rows[0].getNumberOfSubdivisions()))
            beatsPerMinute = newTextInputValue
        })
    }

    function updateSequencerLoopLength(newLoopLengthInMillis) {
        if (loopLengthInMillis === newLoopLengthInMillis) { // save a little effort by skipping update if it isn't needed
            return
        }
        /**
         * note down current state before changing tempo
         */
        let oldLoopLengthInMillis = loopLengthInMillis
        let wasPaused = paused
        /**
         * update states
         */
        loopLengthInMillis = newLoopLengthInMillis
        pause()
        sequencer.setLoopLengthInMillis(loopLengthInMillis)
        // scale the 'current time within loop' up or down, such that we have progressed the same percent through the loop 
        // (i.e. keep progressing the sequence from the same place it was in before changing tempo, now just faster or slower)
        mostRecentPauseTimeWithinLoop = (newLoopLengthInMillis / oldLoopLengthInMillis) * mostRecentPauseTimeWithinLoop
        // only unpause if the sequencer wasn't paused before
        if (!wasPaused) {
            unpause()
        }
    }

    function initializeSubdivisionTextInputsValuesAndStyles() {
        for (let rowIndex = 0; rowIndex < sequencer.rows.length; rowIndex++) {
            let textArea = document.createElement("textarea");
            textArea.cols = "3"
            textArea.rows = "1"
            textArea.style.position = "absolute"
            textArea.style.top = "" + (sequencerVerticalOffset + (rowIndex * spaceBetweenSequencerRows) + subdivisionTextInputVerticalPadding) + "px"
            textArea.style.left = "" + (sequencerHorizontalOffset + sequencerWidth + subdivisionTextInputHorizontalPadding) + "px"
            textArea.style.borderColor = sequencerAndToolsLineColor = sequencerAndToolsLineColor
            textArea.value = sequencer.rows[rowIndex].getNumberOfSubdivisions()
            domElements.divs.subdivisionTextInputs.appendChild(textArea);
            // note for later: the opposite of appendChild is removeChild
            subdivisionTextInputs.push(textArea)
            // textArea.disabled = "true" // todo: get rid of this line once the subdivision text inputs are functioning
        }
    }

    function initializeSubdivisionTextInputsActionListeners() {
        for (let rowIndex = 0; rowIndex < sequencer.numberOfRows; rowIndex++) {
            let subdivisionTextInput = subdivisionTextInputs[rowIndex]
            subdivisionTextInput.addEventListener('blur', (event) => {
                let newTextInputValue = subdivisionTextInput.value.trim() // remove whitespace from beginning and end of input then store it
                if (newTextInputValue === "" || isNaN(newTextInputValue)) { // check if new input is a real number. if not, switch input box back to whatever value it had before.
                    newTextInputValue = sequencer.rows[rowIndex].getNumberOfSubdivisions()
                }
                newTextInputValue = parseInt(newTextInputValue) // we should only allow ints here for now, since that is what the existing logic is designed to handle
                newTextInputValue = confineNumberToBounds(newTextInputValue, 1, maximumAllowedNumberOfSubdivisions)
                subdivisionTextInput.value = newTextInputValue
                updateNumberOfSubdivisionsForRow(newTextInputValue, rowIndex)
            })
        }
    }

    // to do: clean up this method
    function updateNumberOfSubdivisionsForRow(newNumberOfSubdivisions, rowIndex) {
        // first delete all existing notes from the display for the changed row,
        // because now they may be out of date or some of them may have been deleted,
        // and the simplest thing to do may just be to delete them all then redraw
        // the current state of the sequencer for the changed row.
        /**
         * found a problem with deleting only a single row. shapes are layered on-screen in the order they are 
         * drawn (newer on top), so re-drawing only one row including its subdivision lines means if we move a 
         * circle from another line onto the row with newly drawn subdivision lines, the note will show up 
         * behind the subdivision lines. it isn't simple to change layer ordering in two.js, so instead of
         * re-drawing single rows, we will redraw the entire sequencer's notes whenever a big change 
         * happens, since it is simpler. also since notes are scheduled ahead of time, the extra computation
         * shouldn't affect the timing of the drums at all.
         */
        removeAllCirclesFromDisplay()

        // now update the sequencer data structure to reflect the new number of subdivisions.
        // call the sequencer's 'update subdivisions for row' method etc.

        // set some variables to make things simpler, so that the rest of the logic can follow one path regardless of which row was updated
        let oldNumberOfBeatsOnTopRow = sequencer.rows[0].getNumberOfSubdivisions()
        let oldNumberOfSubdivisionsPerBeatOnBottomRow = sequencer.rows[1].getNumberOfSubdivisions() / oldNumberOfBeatsOnTopRow
        let newNumberOfBeatsOnTopRow = oldNumberOfBeatsOnTopRow;
        let newNumberOfSudvisisionsPerBeatOnBottomRow = oldNumberOfSubdivisionsPerBeatOnBottomRow;
        if (rowIndex === 0) {
            newNumberOfBeatsOnTopRow = newNumberOfSubdivisions;
        } else if (rowIndex === 1) {
            newNumberOfSudvisisionsPerBeatOnBottomRow = newNumberOfSubdivisions;
        }

        // deal with row 0 (the top row)
        sequencer.setNumberOfSubdivisionsForRow(newNumberOfBeatsOnTopRow, 0)
        if (newNumberOfBeatsOnTopRow > oldNumberOfBeatsOnTopRow) {
            // special case for the metronome: if there are more subdivisions being added to the row, fill in the remaining beats with a new note
            for (let i = oldNumberOfBeatsOnTopRow; i < newNumberOfBeatsOnTopRow; i++) {
                // let newNode = sampleBankNodeGenerator.createNewNodeForSample(MID)
                // newNode.priority = (loopLengthInMillis / newNumberOfSubdivisions) * 2
                sequencer.rows[0].notesList.insertNode(new PriorityLinkedListNode(idGenerator.getNextId(), (loopLengthInMillis / newNumberOfSubdivisions) * i, 
                {
                    lastScheduledOnIteration: NOTE_HAS_NEVER_BEEN_PLAYED,
                    sampleName: MID,
                    beat: i,
                }));
            }
        }
        
        // update the bottom row to have the right number of subdivisions for how many beats there are in the top row now
        sequencer.rows[1].setNumberOfSubdivisions(newNumberOfBeatsOnTopRow * newNumberOfSudvisisionsPerBeatOnBottomRow)

        // now deal with row 1 (the bottom row).
        // to keep it simple for now, let's just delete everything from the bottom and add all new stuff..
        sequencer.rows[1].notesList = new PriorityLinkedList() // i haven't implemented the actual method to reset a row yet.. this should work for now

        // fill in all new notes for the bottom row. skip anything that falls on a beat, since the top row contains all those. the bottom row is just for subdivisions.
        for (let i = 0; i < sequencer.rows[1].getNumberOfSubdivisions(); i++) {
            if (i % newNumberOfSudvisisionsPerBeatOnBottomRow === 0) {
                continue; // for the bottom row, skip notes that fall on a beat
            }
            sequencer.rows[1].notesList.insertNode(new PriorityLinkedListNode(idGenerator.getNextId(), (loopLengthInMillis / sequencer.rows[1].getNumberOfSubdivisions()) * i, 
            {
                lastScheduledOnIteration: NOTE_HAS_NEVER_BEEN_PLAYED,
                sampleName: MID,
                beat: i,
            }));
        }

        // then we will add the notes from the sequencer data structure to the display, so the display accurately reflects the current state of the sequencer.
        drawNotesToReflectSequencerCurrentState()
        updateSequencerLoopLength(convertBeatsPerMinuteToLoopLengthInMillis(beatsPerMinute, sequencer.rows[0].getNumberOfSubdivisions()))
    }

    // given a number and an upper and lower bound, confine the number to be between the bounds.
    // if the number if below the lower bound, return the lower bound.
    // if it is above the upper bound, return the upper bound.
    // if it is between the bounds, return the number unchanged.
    function confineNumberToBounds(number, lowerBound, upperBound) {
        if (number < lowerBound) {
            return lowerBound
        } else if (number > upperBound) {
            return upperBound
        } else {
            return number
        }
    }

    // quick happy-path unit test for confineNumberToBounds()
    function testConfineNumberToBounds() {
        assertEquals(5, confineNumberToBounds(4, 5, 10), "number below lower bound")
        assertEquals(5, confineNumberToBounds(5, 5, 10), "number same as lower bound")
        assertEquals(6, confineNumberToBounds(6, 5, 10), "number between the bounds")
        assertEquals(10, confineNumberToBounds(10, 5, 10), "number same as upper bound")
        assertEquals(10, confineNumberToBounds(11, 5, 10), "number above upper bound")
    }
}
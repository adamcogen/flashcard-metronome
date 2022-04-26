/**
 * This file contains the main logic and function definitions for running and updating the sequencer, its on-screen display, etc.
 */

window.onload = () => {

    // Store DOM elements we use, so that we can access them without having to pull them from the DOM each time
    let domElements = {
        divs: {
            drawShapes: document.getElementById('draw-shapes'),
            tempoTextInputs: document.getElementById('tempo-text-inputs'),
            subdivisionTextInputs: document.getElementById('subdivision-text-inputs'),
            flashcardTextInputDiv: document.getElementById('flashcard-text-input-div')
        },
        textInputs: {
            loopLengthMillis: document.getElementById('text-input-loop-length-millis'),
            flashcardTextInput: document.getElementById('flashcard-text-input'),
        },
        images: {
            settingsIcon: document.getElementById('settings-icon'),
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
    samples[HIGH] = new SequencerNoteType(loadSample(HIGH, SOUND_FILES_PATH + HIGH + WAV_EXTENSION), '#bd3b07')
    samples[MID] = new SequencerNoteType(loadSample(MID, SOUND_FILES_PATH + MID + WAV_EXTENSION), '#1b617a')
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
    window.onclick = () => {
        audioContext.resume()
    }

    /**
     * drum machine configurations
     */
    // assume the metronome is starting with 4 beats per loop
    let beatsPerMinute = 70;
    let loopLengthInMillis = convertBeatsPerMinuteToLoopLengthInMillis(beatsPerMinute, 4); // length of the whole drum sequence (loop), in millliseconds
    const LOOK_AHEAD_MILLIS = 200; // number of milliseconds to look ahead when scheduling notes to play. note bigger value means that there is a longer delay for sounds to stop after the 'pause' button is hit.
    /**
     * gui settings: sequencer
     */
    let sequencerVerticalOffset = 130
    let sequencerHorizontalOffset = 60
    let sequencerWidth = 350
    let spaceBetweenSequencerRows = 20 // consider putting the rows on top of each other. there are only 2 rows currently -- one for beats, and one for subdivisions. there should be no overlapping notes on the two rows.
    let timeTrackerHeight = 20
    let unplayedCircleRadius = 10
    let playedCircleRadius = 12
    let smallUnplayedCircleRadius = 6
    let smallPlayedCircleRadius = 7
    /**
     * gui settings: pause button
     */
    let pauseButtonVerticalOffset = sequencerVerticalOffset + 140
    let pauseButtonHorizontalOffset = sequencerHorizontalOffset
    let pauseButtonWidth = 48
    let pauseButtonHeight = 48
    /**
     * gui settings: reset sequence / flashcards button
     */
    let resetButtonVerticalOffset = sequencerVerticalOffset + 140
    let resetButtonHorizontalOffset = sequencerHorizontalOffset  + 110
    let resetButtonWidth = 48
    let resetButtonHeight = 48
    /**
     * gui settings: tap tempo button
     */
    let tapTempoButtonVerticalOffset = sequencerVerticalOffset + 140
    let tapTempoButtonHorizontalOffset = sequencerHorizontalOffset  + 220
    let tapTempoButtonWidth = 48
    let tapTempoButtonHeight = 48
    /**
     * gui settings: tap tempo button
     */
    let settingsButtonVerticalOffset = sequencerVerticalOffset + 140
    let settingsButtonHorizontalOffset = sequencerHorizontalOffset  + 330
    let settingsButtonWidth = 48
    let settingsButtonHeight = 48
    /**
     * gui settings: colors
     */
    let sequencerAndToolsLineColor = '#707070'
    let sequencerAndToolsLineWidth = 3
    /**
     * tempo (beats per minute) text input settings
     */
    beatsPerMinuteTextInputHorizontalOffset = sequencerHorizontalOffset + 100
    beatsPerMinuteTextInputVerticalOffset = sequencerVerticalOffset + 60
    domElements.divs.tempoTextInputs.style.left = "" + (beatsPerMinuteTextInputHorizontalOffset + 70 ) + "px"
    domElements.divs.tempoTextInputs.style.top = "" + (beatsPerMinuteTextInputVerticalOffset - 18) + "px"
    let minimumAllowedBeatsPerMinute = 20;
    let maximumAllowedBeatsPerMinute = 500;
    /**
     * subdivision text input settings
     */
    let maximumAllowedNumberOfSubdivisions = 100
    // top row ('number of beats') text input
    let numberOfBeatsTextInputXPosition = sequencerHorizontalOffset + 70
    let numberOfBeatsTextInputYPosition = sequencerVerticalOffset + 220
    // bottom row ('number of subdivisions per beat') text input
    let numberOfSubdivisionsPerBeatTextInputXPosition = sequencerHorizontalOffset + 290
    let numberOfSubdivisionsPerBeatTextInputYPosition = sequencerVerticalOffset + 220
    // default subdivision text input constants. not planning for these to be used by the metronome currently
    let subdivisionTextInputHorizontalPadding = 10
    let subdivisionTextInputVerticalPadding = -17
    // 'repeat flashcards?' checkbox position
    let showAllFlashcardsBeforeRepeatingAnyCheckboxVerticalPosition = sequencerVerticalOffset + 670
    let showAllFlashcardsBeforeRepeatingAnyCheckboxHorizontalPosition = sequencerHorizontalOffset + 350
    // 'show next flashcard preview?' checkbox position
    let showNextFlashcardPreviewCheckboxVerticalPosition = sequencerVerticalOffset + 320
    let showNextFlashcardPreviewCheckboxHorizontalPosition = sequencerHorizontalOffset + 320
    // 'show each flashcard for how many measures?' text input position
    let showEachFlashcardForHowManyMeasuresTextInputVerticalPosition = sequencerVerticalOffset + 275
    let showEachFlashcardForHowManyMeasuresTextInputHorizontalPosition = sequencerHorizontalOffset + 320
    // 'show next flashcard preview on which beat?' text input position
    let showPreviewOnWhichBeatTextInputVerticalPosition = sequencerVerticalOffset + 355
    let showPreviewOnWhichBeatTextInputHorizontalPosition = sequencerHorizontalOffset + 290
    // 'randomize order?' checkbox position
    let randomizeFlashcardOrderCheckboxVerticalPosition = sequencerVerticalOffset + 640
    let randomizeFlashcardOrderCheckboxHorizontalPosition = sequencerHorizontalOffset + 270

    // these will be used to slowly change colors of buttons that are pressed
    let clickButtonsForHowManyMilliseconds = 200;
    let lastResetButtonPressTime = Number.MIN_SAFE_INTEGER;
    let clickedButtonColor = "#bfbfbf";
    let lighterClickedButtonColor = "#c4c4c4";
    let showAllFlashcardsBeforeRepeatingAny = true;

    // these will be used for the 'tap tempo' button logic, to track when it was last clicked
    let absoluteTimeOfMostRecentTapTempoButtonClick = Number.MIN_SAFE_INTEGER;
    let tapTempoButtonClickCount = -1;

    // initialize sequencer data structure
    let sequencer = new Sequencer(2, loopLengthInMillis)
    sequencer.rows[0].setNumberOfSubdivisions(4)
    sequencer.rows[0].setQuantization(true)
    sequencer.rows[1].setNumberOfSubdivisions(1)
    sequencer.rows[1].setQuantization(true)

    initializeFlashcardTextInputValue()

    let allFlashcards = parseFlashcardsFromString(domElements.textInputs.flashcardTextInput.value)
    let currentRemainingFlashcards = copyArray(allFlashcards)
    let indexOfNextFlashcardToShow = -1;

    let numberOfMeasuresToShowEachFlashcardFor = 2;
    let beatNumberToShowNextFlashcardPreviewOn = 3;
    let showPreviewOfNextFlashcard = true;
    let randomizeFlashcardOrder = true;

    let showSettingsMenu = false;

    // create and store on-screen lines, shapes, etc. (these will be Two.js 'path' objects)
    // let timeTrackerLines = initializeTimeTrackerLines() // list of lines that move to represent the current time within the loop
    let pauseButtonShapes = initializePauseButtonShapes() // a rectangle that will act as the pause button for now
    let resetButtonShapes = initializeResetButtonShapes() // a rectangle that will act as the 'reset sequencer / metronome / flashcard deck' button for now
    let tapTempoButtonShapes = initializeTapTempoButtonShapes() // a rectangle that will act as the 'tap tempo' button for now
    let settingsButtonShapes = initializeSettingsButtonShapes() // a rectangle that will act as the 'settings' button for now
    let showAllFlashcardsBeforeRepeatingAnyCheckbox = initializeCheckbox(showAllFlashcardsBeforeRepeatingAnyCheckboxVerticalPosition, showAllFlashcardsBeforeRepeatingAnyCheckboxHorizontalPosition)
    let showNextFlashcardPreviewCheckbox = initializeCheckbox(showNextFlashcardPreviewCheckboxVerticalPosition, showNextFlashcardPreviewCheckboxHorizontalPosition)
    // initialize labels for text inputs
    let beatsPerMinuteTextLeft = initializeLabelText("Tempo: ", beatsPerMinuteTextInputHorizontalOffset, beatsPerMinuteTextInputVerticalOffset, "left") // a label next to the 'beats per minute' text input
    let beatsPerMinuteTextRight = initializeLabelText("bpm", beatsPerMinuteTextInputHorizontalOffset + 140, beatsPerMinuteTextInputVerticalOffset, "left") // a label next to the 'beats per minute' text input
    let numberOfBeatsText = initializeLabelText("beats: ", numberOfBeatsTextInputXPosition - 5, numberOfBeatsTextInputYPosition + 15, "right") // a labdel next to the 'number of beats' text input
    let numberOfSubdivisionsPerBeatText = initializeLabelText("subdivisions: ", numberOfSubdivisionsPerBeatTextInputXPosition - 5, numberOfSubdivisionsPerBeatTextInputYPosition + 17, "right") // a label next to the 'number of subdivisions per beat' text input
    let showAllFlashcardsBeforeRepeatingAnyCheckboxText = initializeLabelText("show all flashcards before repeating?", showAllFlashcardsBeforeRepeatingAnyCheckboxHorizontalPosition - 5, showAllFlashcardsBeforeRepeatingAnyCheckboxVerticalPosition + 14, "right") // a label next to the 'repeat flashcards?' checkbox
    let showNextFlashcardPreviewCheckboxText = initializeLabelText("show preview of next flashcard?", showNextFlashcardPreviewCheckboxHorizontalPosition - 5, showNextFlashcardPreviewCheckboxVerticalPosition + 14, "right")
    let showPreviewOnWhichBeatText = initializeLabelText("show preview on which beat?", showPreviewOnWhichBeatTextInputHorizontalPosition - 5, showPreviewOnWhichBeatTextInputVerticalPosition + 17, "right")
    let showEachFlashcardForHowManyMeasuresText = initializeLabelText("show card for how many measures?", showEachFlashcardForHowManyMeasuresTextInputHorizontalPosition - 5, showEachFlashcardForHowManyMeasuresTextInputVerticalPosition + 17, "right")
    let currentFlashcardLabelText = initializeLabelText(">", sequencerHorizontalOffset - 10, sequencerVerticalOffset - 90, "left")
    let currentFlashcardText = initializeLabelText("", sequencerHorizontalOffset + 10, sequencerVerticalOffset - 90, "left")
    let nextFlashcardPreviewText = initializeLabelText("", sequencerHorizontalOffset + 10, sequencerVerticalOffset - 60, "left")
    // let currentBeatNumber = initializeLabelText("", 175, 570, "left")
    // let currentMeasureNumber = initializeLabelText("", 175, 600, "left")
    let cardsRemainingText = initializeLabelText("Cards used: 0 / " + allFlashcards.length, sequencerHorizontalOffset + 110, sequencerVerticalOffset + 95, "left")
    // let measureNumberLabel = initializeLabelText("measure:", sequencerHorizontalOffset + sequencerWidth, sequencerVerticalOffset - 20, "left")
    // measureNumberLabel.size = 12
    let numberOfMeasuresCardHasBeenShownForSoFarText = initializeLabelText("0 / " + numberOfMeasuresToShowEachFlashcardFor, sequencerHorizontalOffset + sequencerWidth, sequencerVerticalOffset, "left")
    let flashcardTextInputLabel = initializeLabelText("flashcards:", sequencerHorizontalOffset + 140, sequencerVerticalOffset + 405, "left")
    let randomizeFlashcardOrderCheckbox = initializeCheckbox(randomizeFlashcardOrderCheckboxVerticalPosition, randomizeFlashcardOrderCheckboxHorizontalPosition)
    let randomizeFlashcardOrderText = initializeLabelText("randomize order?", randomizeFlashcardOrderCheckboxHorizontalPosition - 5, randomizeFlashcardOrderCheckboxVerticalPosition + 14, "right")

    two.update(); // this initial 'update' creates SVG '_renderer' properties for our shapes that we can add action listeners to, so it needs to go here

    initializeTempoTextInputValuesAndStyles();
    initializeTempoTextInputActionListeners();

    // start putting together some subdivision text input proof-of-concept stuff here
    let subdivisionTextInputs = []
    initializeSubdivisionTextInputsValuesAndStyles();
    initializeSubdivisionTextInputsActionListeners();

    let showPreviewOnWhichBeatTextInput = initializeShowPreviewOfNextFlashcardOnWhichBeatTextInput();
    let showEachFlashcardForHowManyMeasureTextInput = initializeShowEachFlashcardForHowManyMeasuresTextInput();

    addPauseButtonActionListeners()
    addResetButtonActionListeners()
    addTapTempoButtonActionListeners()
    addSettingsButtonActionListeners()
    addShowAllFlashcardsBeforeRepeatingAnyCheckboxActionListeners()
    addShowNextFlashcardPreviewCheckboxActionListeners()
    addRandomizeFlashcardOrderCheckboxActionListeners()

    initializeFlashcardTextInputStyles()
    initializeFlashcardTextInputActionListeners()

    adjustSettingsMenu()

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
    testParseFlashcardsFromString()

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
     *   - we calculate 'current time within current loop', accounting for all the pause-related stuff we tracking (see the code below for how)
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
    // after unpausing, wait LOOK_AHEAD_WINDOW milliseconds before actually starting to move time forward.
    // that way any notes that happen right after unpausing have time to get scheduled.
    // the variable below is used to track how long we've waited since unpausing.
    let timeWaitedSoFarForLookAheadWindowToElapseAfterUnpausing = 0

    /**
     * Next need to think through how to calculate total runtime excluding pauses, so that we can track total number of loops so far.
     * I think to do this, we need to keep track of two things:
     * - the total runtime of the sequencer before the most recent pause
     * - the total runtime of the sequencer after the most recent pause.
     * I think the first piece (total runtime before most recent pause) can start out as 0, and whenever the sequencer is paused, we can 
     * just add (current time - most recent unpause time) to its value. we already keep track of most recent pause time, so this should be 
     * pretty simple.
     * The second piece of this calculation (total runtime of the sequencer after most recent pause time) has two possibilities. if the
     * sequencer is unpasued, the value can also just be calculated as (current time - most recent unpause time). But if the sequencer is
     * paused, the value can just be left as 0.
     * then, to calculate total runtime of the sequencer so far, we can just add the two components of the calculation together, as in:
     * (the total runtime of the sequencer before the most recent pause + the total runtime of the sequencer after the most recent pause)
     */
    let totalRuntimeBeforeMostRecentPause = 0;
    let totalRuntimeAfterMostRecentPause = 0;
    let totalRuntimeOfSequencerSoFar = 0;
    let totalNumberOfLoopsSoFar = 0;

    /**
     * some variables for determining whenever we get to the next beat or the next measure. these will store the last recorded value of beat 
     * and measure number, so that whenever those values get incremented, they won't match the values previously stored in these variables.
     */
    let beatOfLastUpdate = -1;
    let loopNumberOfLastUpdate = -1;

    pause()

    // start main recursive update loop, where all state updates will happen
    requestAnimationFrameShim(draw)

    /**
     * end of main logic, start of function definitions.
     */

    // this method is the 'update' loop that will keep updating the page. after first invocation, this method basically calls itself recursively forever.
    function draw() {
        currentTime = audioContext.currentTime * 1000;

        if (paused) {
            currentTimeWithinCurrentLoop = mostRecentPauseTimeWithinLoop // updated for the sake of the on-screen time-tracker lines
        } else {
            // after unpausing, we want to wait for the lookahead time window to elapse, so that notes that should happen immediately after unpausing have a chance to get scheduled.
            timeWaitedSoFarForLookAheadWindowToElapseAfterUnpausing = currentTime - mostRecentUnpauseTime
            if (timeWaitedSoFarForLookAheadWindowToElapseAfterUnpausing < LOOK_AHEAD_MILLIS) {
                // console.log("still waiting... " + timeWaitedSoFarForLookAheadWindowToElapseAfterUnpausing + " millis have elapsed since last 'unpause' so far")
                currentTimeWithinCurrentLoop = mostRecentPauseTimeWithinLoop
            } else {
                // enough time has elapsed since the last unpause that we don't need to wait any extra time, we can just keep scheduling notes like normal
                currentTimeWithinCurrentLoop = (currentTime - mostRecentUnpauseTime + mostRecentPauseTimeWithinLoop) % loopLengthInMillis
            }
            theoreticalStartTimeOfCurrentLoop = (currentTime - currentTimeWithinCurrentLoop) // no need to update if we are currently paused
        }

        timeTrackersXPosition = sequencerHorizontalOffset + (sequencerWidth * (currentTimeWithinCurrentLoop / loopLengthInMillis))
        currentBeatWithinLoop = Math.floor(currentTimeWithinCurrentLoop / (loopLengthInMillis / sequencer.rows[0].getNumberOfSubdivisions()))

        // calculate total number of loops so far, ignoring time that elapsed during pauses
        if (paused) {
            totalRuntimeAfterMostRecentPause = 0;
        } else {
            totalRuntimeAfterMostRecentPause = currentTime - mostRecentUnpauseTime
        }
        totalRuntimeOfSequencerSoFar = totalRuntimeBeforeMostRecentPause + totalRuntimeAfterMostRecentPause
        totalNumberOfLoopsSoFar = Math.floor(totalRuntimeOfSequencerSoFar / loopLengthInMillis);
        // add this value so that the count-in will always be shown for one measure:
        totalNumberOfLoopsSoFar += numberOfMeasuresToShowEachFlashcardFor - 1;

        // debug calculation of beat and measure number
        // currentBeatNumber.value = "current beat: " + currentBeatWithinLoop + "";
        // currentMeasureNumber.value = "number of measures so far: " + totalNumberOfLoopsSoFar + "";
        numberOfMeasuresCardHasBeenShownForSoFarText.value = "" + ((totalNumberOfLoopsSoFar % numberOfMeasuresToShowEachFlashcardFor) + 1) + " / " + numberOfMeasuresToShowEachFlashcardFor

        // whenever beat number or measure number changes, update the flashcards as necessary
        if (currentBeatWithinLoop != beatOfLastUpdate || totalNumberOfLoopsSoFar != loopNumberOfLastUpdate) {
            updateFlashcardTexts(currentBeatWithinLoop, totalNumberOfLoopsSoFar)
        }

        beatOfLastUpdate = currentBeatWithinLoop;
        loopNumberOfLastUpdate = totalNumberOfLoopsSoFar;

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

        // this logic handles changing the color of the "reset" button. whenever that button is clicked, 
        // it switches to the "clicked button" color for a bit, then changes back to the "unclicked" color.
        if (currentTime - lastResetButtonPressTime < clickButtonsForHowManyMilliseconds) {
            resetButtonShapes[0].fill = clickedButtonColor;
        } else {
            resetButtonShapes[0].fill = "transparent"
        }

        // this logic handles "resetting" the tap tempo button. if that button hasn't been clicked in a while,
        // we will reset its state and "forget" the timestamp that it was clicked last.
        // see the block comment above 'addTapTempoButtonActionListeners()' for more info on how this works.
        let maximumAmountOfTimeToWaitForNextTapTempoButtonClick = convertBeatsPerMinuteToBeatLengthInMillis(Math.max(minimumAllowedBeatsPerMinute - 5, 0))
        if (currentTime - absoluteTimeOfMostRecentTapTempoButtonClick > maximumAmountOfTimeToWaitForNextTapTempoButtonClick) {
            resetTapTempoButtonState()
        }

        two.update() // update the GUI display
        requestAnimationFrameShim(draw); // call animation frame update with this 'draw' method again
    }

    function updateFlashcardTexts(beatNumber, measureNumber) {
         // show the current flashcard
         if (measureNumber % numberOfMeasuresToShowEachFlashcardFor === 0 && beatNumber === 0) {
            if (indexOfNextFlashcardToShow !== -1) {
                currentFlashcardText.value = currentRemainingFlashcards[indexOfNextFlashcardToShow];
                if (showAllFlashcardsBeforeRepeatingAny) {
                    deleteArrayElementAtIndex(currentRemainingFlashcards, indexOfNextFlashcardToShow);
                    cardsRemainingText.value = "Cards used: " + (allFlashcards.length - currentRemainingFlashcards.length) + " / " + allFlashcards.length
                }
            }
        }

        if (currentRemainingFlashcards.length === 0){
            currentRemainingFlashcards = copyArray(allFlashcards);
        }

        // show the preview of the next flashcard
        if ((measureNumber % numberOfMeasuresToShowEachFlashcardFor === numberOfMeasuresToShowEachFlashcardFor - 1) && beatNumber >= beatNumberToShowNextFlashcardPreviewOn) {
            if (beatNumber === beatNumberToShowNextFlashcardPreviewOn) {
                if (randomizeFlashcardOrder) {
                    indexOfNextFlashcardToShow = getRandomInteger(currentRemainingFlashcards.length);
                } else {
                    indexOfNextFlashcardToShow = 0;
                }
                if (showPreviewOfNextFlashcard) {
                    nextFlashcardPreviewText.value = currentRemainingFlashcards[indexOfNextFlashcardToShow];
                }
            }
        } else {
            nextFlashcardPreviewText.value = ""
        }

    }

    function scheduleNotesForCurrentTime(nextNoteToSchedule, sequencerRowIndex, currentTime, currentTimeWithinCurrentLoop, actualStartTimeOfCurrentLoop) {
        //let numberOfLoopsSoFar = Math.floor(currentTime / loopLengthInMillis) // mostly used to make sure we don't schedule the same note twice. this number doesn't account for pauses, but i think that's fine. todo: make sure that's fine

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
            if (nextNoteToSchedule.priority >= currentTimeWithinCurrentLoop && totalNumberOfLoopsSoFar > nextNoteToSchedule.data.lastScheduledOnIteration) {
                scheduleDrumSample(actualStartTimeOfCurrentLoop + nextNoteToSchedule.priority, nextNoteToSchedule.data.sampleName)
                nextNoteToSchedule.data.lastScheduledOnIteration = totalNumberOfLoopsSoFar // record the last iteration that the note was played on to avoid duplicate scheduling within the same iteration
            }
            nextNoteToSchedule = nextNoteToSchedule.next
        }

        // this will be the second part: if the look-ahead window went past the end of the loop, schedule notes from the beginning
        // of the loop to the end of leftover look-ahead window time.
        let endTimeToScheduleUpToFromBeginningOfLoop = endTimeOfNotesToSchedule - loopLengthInMillis // calulate leftover time to schedule for from beginning of loop, e.g. from 0 to 7 millis from above example
        let actualStartTimeOfNextLoop = actualStartTimeOfCurrentLoop + loopLengthInMillis
        let numberOfLoopsSoFarPlusOne = totalNumberOfLoopsSoFar + 1
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

    /**
     * the drum sequencer requires tempo be updated as loop length in millis, but the metronome
     * uses tempo as beats per minute. this method is for making the necessary conversion.
     */
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

    /**
     * used in the 'tap tempo' button logic, to convert the time between each click into a beats-per-minute value.
     */
    function convertBeatLengthInMillisToBeatsPerMinute(millisecondsPerBeat) {
        // needed to do some more dimensional analysis haha..
        let millisecondsPerSecond = 1000
        let secondsPerMinute = 60
        return (secondsPerMinute * millisecondsPerSecond) / millisecondsPerBeat
    }

    function convertBeatsPerMinuteToBeatLengthInMillis(beatsPerMinute) {
        let millisecondsPerSecond = 1000
        let secondsPerMinute = 60
        return (secondsPerMinute * millisecondsPerSecond) / beatsPerMinute
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
        
        circle._renderer.elem.style.cursor = "pointer"

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

    function initializeLabelText(text, xPosition, yPosition, alignment="left") {
        label = new Two.Text(text, xPosition, yPosition);
        label.fill = "black";
        // label.stroke = "white";
        label.size = 20;
        label.alignment = alignment
        label.family = "Arial, sans-serif"
        // label.family = "Courier New, monospace"
        two.add(label);
        two.update();
        // prevent text selection
        label._renderer.elem.addEventListener('mousedown', (event) => {
            event.preventDefault();
        })
        label._renderer.elem.style.userSelect = "none";
        label._renderer.elem.style.cursor = "default";
        return label
    }

    function initializePauseButtonShapes() {
        let pauseButton = two.makePath(
            [
                new Two.Anchor(pauseButtonHorizontalOffset, pauseButtonVerticalOffset),
                new Two.Anchor(pauseButtonHorizontalOffset + pauseButtonWidth, pauseButtonVerticalOffset),
                new Two.Anchor(pauseButtonHorizontalOffset + pauseButtonWidth, pauseButtonVerticalOffset + pauseButtonHeight),
                new Two.Anchor(pauseButtonHorizontalOffset, pauseButtonVerticalOffset + pauseButtonHeight),
            ],
            false
        );
        pauseButton.fill = 'transparent'

        // draw pause button icon (2 rectangles for now. could also consider hiding this icon and showing a 'play button' triangle icon depending on whether metronome is paused or not)
        // to do: clean these up a bit so that we can resize the pause button and these will scale automatically.
        // or at least more carefully calculate the size of the icon's rectangles once we settle on the size of the button.
        let pauseButtonIconRectangleWidth = 10
        let pauseButtonIconRectangleHeight = 27
        let pauseButtonIconRectangle1 = two.makePath(
            [
                new Two.Anchor(pauseButtonHorizontalOffset + 10, pauseButtonVerticalOffset + 10),
                new Two.Anchor(pauseButtonHorizontalOffset + 10 + pauseButtonIconRectangleWidth, pauseButtonVerticalOffset + 10),
                new Two.Anchor(pauseButtonHorizontalOffset + 10 + pauseButtonIconRectangleWidth, pauseButtonVerticalOffset + 10 + pauseButtonIconRectangleHeight),
                new Two.Anchor(pauseButtonHorizontalOffset + 10, pauseButtonVerticalOffset + 10 + pauseButtonIconRectangleHeight),
            ],
            false
        );
        pauseButtonIconRectangle1.fill = 'transparent'

        let pauseButtonIconRectangle2 = two.makePath(
            [
                new Two.Anchor(pauseButtonHorizontalOffset + 27, pauseButtonVerticalOffset + 10),
                new Two.Anchor(pauseButtonHorizontalOffset + 27 + pauseButtonIconRectangleWidth, pauseButtonVerticalOffset + 10),
                new Two.Anchor(pauseButtonHorizontalOffset + 27 + pauseButtonIconRectangleWidth, pauseButtonVerticalOffset + 10 + pauseButtonIconRectangleHeight),
                new Two.Anchor(pauseButtonHorizontalOffset + 27, pauseButtonVerticalOffset + 10 + pauseButtonIconRectangleHeight),
            ],
            false
        );
        pauseButtonIconRectangle2.fill = 'transparent'

        let pauseButtonShapes = [pauseButton, pauseButtonIconRectangle1, pauseButtonIconRectangle2]

        two.update()

        for (let shape of pauseButtonShapes) {
            shape.linewidth = sequencerAndToolsLineWidth
            shape.stroke = sequencerAndToolsLineColor
        }

        return pauseButtonShapes
    }

    function addPauseButtonActionListeners() {
        for (let shape of pauseButtonShapes) {
            shape._renderer.elem.addEventListener('click', (event) => {
                togglePaused()
            })
            shape._renderer.elem.style.cursor = "pointer";
        }
    }

    function initializeResetButtonShapes() {
        let resetButton = two.makePath(
            [
                new Two.Anchor(resetButtonHorizontalOffset, resetButtonVerticalOffset),
                new Two.Anchor(resetButtonHorizontalOffset + resetButtonWidth, resetButtonVerticalOffset),
                new Two.Anchor(resetButtonHorizontalOffset + resetButtonWidth, resetButtonVerticalOffset + resetButtonHeight),
                new Two.Anchor(resetButtonHorizontalOffset, resetButtonVerticalOffset + resetButtonHeight),
            ],
            false
        );
        resetButton.linewidth = sequencerAndToolsLineWidth
        resetButton.stroke = sequencerAndToolsLineColor
        resetButton.fill = 'transparent'

        let resetButtonText = initializeLabelText("<<", resetButtonHorizontalOffset + 23, resetButtonVerticalOffset + 22, "center")
        resetButtonText.fill = sequencerAndToolsLineColor
        resetButtonText.stroke = 'transparent'
        resetButtonText.size = 30

        return [resetButton, resetButtonText]
    }

    function addResetButtonActionListeners() {
        for (shape of resetButtonShapes) {
            shape._renderer.elem.addEventListener('click', (event) => {
                lastResetButtonPressTime = currentTime;
                resetFlashcardMetronome()
            })
            // prevent text selection for the '<<' text label
            shape._renderer.elem.addEventListener('mousedown', (event) => {
                event.preventDefault();
            })
            shape._renderer.elem.style.cursor = "pointer";
        }
    }

    function initializeTapTempoButtonShapes() {
        let tapTempoButton = two.makePath(
            [
                new Two.Anchor(tapTempoButtonHorizontalOffset, tapTempoButtonVerticalOffset),
                new Two.Anchor(tapTempoButtonHorizontalOffset + tapTempoButtonWidth, tapTempoButtonVerticalOffset),
                new Two.Anchor(tapTempoButtonHorizontalOffset + tapTempoButtonWidth, tapTempoButtonVerticalOffset + tapTempoButtonHeight),
                new Two.Anchor(tapTempoButtonHorizontalOffset, tapTempoButtonVerticalOffset + tapTempoButtonHeight),
            ],
            false
        );
        tapTempoButton.linewidth = sequencerAndToolsLineWidth
        tapTempoButton.stroke = sequencerAndToolsLineColor
        tapTempoButton.fill = 'transparent'

        let tapTempoButtonText = initializeLabelText("TAP", tapTempoButtonHorizontalOffset + 25, tapTempoButtonVerticalOffset + 25, "center")
        tapTempoButtonText.fill = sequencerAndToolsLineColor
        tapTempoButtonText.stroke = 'transparent'
        tapTempoButtonText.size = 23
        return [tapTempoButton, tapTempoButtonText]
    }

    /**
     * how the tap tempo button works:
     * the first time you click it, it notes the time it was clicked.
     * then, when you click it again, it notes the time of the second click.
     * then, it calculates a tempo based off the two clicks -- if they were two
     * beats, what would be the bpm?
     * if you click the tap tempo button some more, it keeps calculating new
     * BPMs based on the new click and the one before it. 
     * another important piece is that in the main update loop, there is a check
     * that resets the state of this button -- i.e. if you wait long enough, your
     * most recent click will be forgotten and you will need to click the button
     * twice again if you want to set a new tempo with it.
     * the tap tempo button only ever calculates a tempo based off of two clicks.
     * it would be possible to find the average tempo of a group of many clicks, 
     * but that would be more complicated logic to implement.
     */
    function addTapTempoButtonActionListeners() {
        for (shape of tapTempoButtonShapes) {
            shape._renderer.elem.addEventListener('click', (event) => {
                tapTempoButtonClickCount++;
                pause();
                // toggle button color back and forth between 'clicked' and 'unclicked' color
                if (tapTempoButtonClickCount % 2 === 0) {
                    playDrumSampleNow(HIGH);
                    tapTempoButtonShapes[0].fill = lighterClickedButtonColor
                } else {
                    playDrumSampleNow(MID);
                    tapTempoButtonShapes[0].fill = clickedButtonColor
                }
                if (absoluteTimeOfMostRecentTapTempoButtonClick === Number.MIN_SAFE_INTEGER) {
                    // the tap tempo button hasn't been clicked in long enough that it was reset.
                    // so just set 'most recent click time' to a new value, but don't calculate 
                    // a tempo based off of it yet, since this is only the first recent click.
                    absoluteTimeOfMostRecentTapTempoButtonClick = currentTime;
                } else {
                    // the tap tempo button has been clicked recently before this click, so
                    // calculate a new tempo based on the time of the recent click and the 
                    // click that caused this mouse event.
                    newTempo = convertBeatLengthInMillisToBeatsPerMinute(currentTime - absoluteTimeOfMostRecentTapTempoButtonClick);
                    setMetronomeTempo(newTempo)
                    absoluteTimeOfMostRecentTapTempoButtonClick = currentTime;
                }
            })
            // prevent text selection for the 'TAP' text label
            shape._renderer.elem.addEventListener('mousedown', (event) => {
                event.preventDefault();
            })
            shape._renderer.elem.style.cursor = "pointer";
        }
    }

    /**
     * reset the state of the tap tempo button.
     * forget about any previous clicks.
     */
    function resetTapTempoButtonState() {
        absoluteTimeOfMostRecentTapTempoButtonClick = Number.MIN_SAFE_INTEGER
        tapTempoButtonClickCount = -1;
        tapTempoButtonShapes[0].fill = 'transparent'
    }

    function initializeSettingsButtonShapes() {
        let buttonRectangle = two.makePath(
            [
                new Two.Anchor(settingsButtonHorizontalOffset, settingsButtonVerticalOffset),
                new Two.Anchor(settingsButtonHorizontalOffset + settingsButtonWidth, settingsButtonVerticalOffset),
                new Two.Anchor(settingsButtonHorizontalOffset + settingsButtonWidth, settingsButtonVerticalOffset + settingsButtonHeight),
                new Two.Anchor(settingsButtonHorizontalOffset, settingsButtonVerticalOffset + settingsButtonHeight),
            ],
            false
        );
        buttonRectangle.linewidth = sequencerAndToolsLineWidth
        buttonRectangle.stroke = sequencerAndToolsLineColor
        buttonRectangle.fill = 'transparent'

        let buttonText = initializeLabelText("", settingsButtonHorizontalOffset + 24, settingsButtonVerticalOffset + 25, "center")
        buttonText.fill = sequencerAndToolsLineColor
        buttonText.stroke = 'transparent'
        buttonText.size = 23

        return [buttonRectangle, buttonText]
    }

    function addSettingsButtonActionListeners() {
        for (shape of settingsButtonShapes) {
            shape._renderer.elem.addEventListener('click', (event) => {
                showSettingsMenu = !showSettingsMenu
                if (showSettingsMenu) {
                    settingsButtonShapes[0].fill = clickedButtonColor
                } else {
                    settingsButtonShapes[0].fill = 'transparent'
                }
                adjustSettingsMenu();
            })
            shape._renderer.elem.style.cursor = "pointer";
        }

        let icon = domElements.images.settingsIcon
        icon.addEventListener('click', (event) => {
            showSettingsMenu = !showSettingsMenu
            if (showSettingsMenu) {
                settingsButtonShapes[0].fill = clickedButtonColor
            } else {
                settingsButtonShapes[0].fill = 'transparent'
            }
            adjustSettingsMenu();
        })
        icon.style.cursor = "pointer";
    }

    function adjustSettingsMenu() {
        if (showSettingsMenu) {
            // show the settings menu
            numberOfBeatsText.fill = "black"
            numberOfSubdivisionsPerBeatText.fill = "black"
            showAllFlashcardsBeforeRepeatingAnyCheckboxText.fill = "black"
            showNextFlashcardPreviewCheckboxText.fill = "black"
            showPreviewOnWhichBeatText.fill = "black"
            showEachFlashcardForHowManyMeasuresText.fill = "black"
            showAllFlashcardsBeforeRepeatingAnyCheckbox.style.display = "block"
            showNextFlashcardPreviewCheckbox.style.display = "block"
            subdivisionTextInputs[0].style.display = "block"
            subdivisionTextInputs[1].style.display = "block"
            showPreviewOnWhichBeatTextInput.style.display = "block"
            showEachFlashcardForHowManyMeasureTextInput.style.display = "block"
            domElements.textInputs.flashcardTextInput.style.display = "block"
            flashcardTextInputLabel.fill = "black"
            randomizeFlashcardOrderText.fill = "black"
            randomizeFlashcardOrderCheckbox.style.display = "block"
        } else {
            // hide the settings menu
            numberOfBeatsText.fill = "transparent"
            numberOfSubdivisionsPerBeatText.fill = "transparent"
            showAllFlashcardsBeforeRepeatingAnyCheckboxText.fill = "transparent"
            showNextFlashcardPreviewCheckboxText.fill = "transparent"
            showPreviewOnWhichBeatText.fill = "transparent"
            showEachFlashcardForHowManyMeasuresText.fill = "transparent"
            showAllFlashcardsBeforeRepeatingAnyCheckbox.style.display = "none"
            showNextFlashcardPreviewCheckbox.style.display = "none"
            subdivisionTextInputs[0].style.display = "none"
            subdivisionTextInputs[1].style.display = "none"
            showPreviewOnWhichBeatTextInput.style.display = "none"
            showEachFlashcardForHowManyMeasureTextInput.style.display = "none"
            domElements.textInputs.flashcardTextInput.style.display = "none"
            flashcardTextInputLabel.fill = "transparent"
            randomizeFlashcardOrderText.fill = "transparent"
            randomizeFlashcardOrderCheckbox.style.display = "none"
        }
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
            totalRuntimeBeforeMostRecentPause += currentTime - mostRecentUnpauseTime
            for (let shape of pauseButtonShapes) {
                shape.fill = clickedButtonColor;
            }
        }
    }

    function unpause() {
        if (paused) {
            paused = false
            mostRecentUnpauseTime = currentTime
            timeWaitedSoFarForLookAheadWindowToElapseAfterUnpausing = 0;
            for (let shape of pauseButtonShapes) {
                shape.fill = "transparent"
            }
            resetTapTempoButtonState()
        }
    }

    function initializeCheckbox(verticalPosition, horizontalPosition) {
        let checkbox = document.createElement("input");
        checkbox.setAttribute("type", "checkbox");
        checkbox.style.position = "absolute";
        checkbox.style.top = "" + verticalPosition + "px";
        checkbox.style.left = "" + horizontalPosition + "px";
        checkbox.style.width = "20px"
        checkbox.style.height = "20px"
        checkbox.style.outline = "20px"
        domElements.divs.subdivisionTextInputs.appendChild(checkbox);
        checkbox.style.cursor = "pointer"
        return checkbox
    }

    function addShowAllFlashcardsBeforeRepeatingAnyCheckboxActionListeners() {
        showAllFlashcardsBeforeRepeatingAnyCheckbox.checked = true
        showAllFlashcardsBeforeRepeatingAnyCheckbox.addEventListener('click', (event) => {
            if (showAllFlashcardsBeforeRepeatingAnyCheckbox.checked) {
                showAllFlashcardsBeforeRepeatingAny = true
            } else {
                showAllFlashcardsBeforeRepeatingAny = false
                resetFlashcards() // reset the flashcard deck back to full
                cardsRemainingText.value = ""
            }
        })
    }

    function addShowNextFlashcardPreviewCheckboxActionListeners() {
        // initialize checkbox 'checked' starting value based on starting value of relevant variable
        showNextFlashcardPreviewCheckbox.checked = showPreviewOfNextFlashcard;
        showNextFlashcardPreviewCheckbox.addEventListener('click', (event) => {
            if (showNextFlashcardPreviewCheckbox.checked) {
                showPreviewOnWhichBeatText.fill = "black"
                showPreviewOnWhichBeatTextInput.disabled = false
                showPreviewOfNextFlashcard = true
            } else {
                showPreviewOnWhichBeatText.fill = "gray"
                showPreviewOnWhichBeatTextInput.disabled = true
                showPreviewOfNextFlashcard = false
            }
        })
    }

    function addRandomizeFlashcardOrderCheckboxActionListeners() {
        randomizeFlashcardOrderCheckbox.checked = randomizeFlashcardOrder;
        randomizeFlashcardOrderCheckbox.addEventListener('click', (event) => {
            if (randomizeFlashcardOrderCheckbox.checked) {
                randomizeFlashcardOrder = true;
                showAllFlashcardsBeforeRepeatingAnyCheckbox.disabled = false;
                showAllFlashcardsBeforeRepeatingAnyCheckboxText.fill = "black";
                resetFlashcards();
            } else {
                randomizeFlashcardOrder = false;
                showAllFlashcardsBeforeRepeatingAnyCheckbox.disabled = true;
                showAllFlashcardsBeforeRepeatingAnyCheckboxText.fill = "gray";
                resetFlashcards();
            }
        })
    }

    function initializeShowPreviewOfNextFlashcardOnWhichBeatTextInput() {
        let textbox = document.createElement("textarea");
        textbox.style.position = "absolute"
        textbox.style.top = "" + showPreviewOnWhichBeatTextInputVerticalPosition + "px"
        textbox.style.left = "" + showPreviewOnWhichBeatTextInputHorizontalPosition + "px"
        textbox.cols = "3"
        textbox.rows = "1"
        domElements.divs.subdivisionTextInputs.appendChild(textbox);
        textbox.addEventListener('blur', (event) => {
            beatNumberToShowNextFlashcardPreviewOn = filterTextInputToInteger(textbox.value, beatNumberToShowNextFlashcardPreviewOn + 1, 1, sequencer.rows[0].getNumberOfSubdivisions()) - 1
            textbox.value = beatNumberToShowNextFlashcardPreviewOn + 1
        });
        // start the checkbox as disabled based on starting value of the relevant variable
        textbox.value = beatNumberToShowNextFlashcardPreviewOn + 1
        textbox.disabled = !showPreviewOfNextFlashcard
        return textbox;
    }

    function initializeShowEachFlashcardForHowManyMeasuresTextInput() {
        let textbox = document.createElement("textarea");
        textbox.style.position = "absolute"
        textbox.style.top = "" + showEachFlashcardForHowManyMeasuresTextInputVerticalPosition + "px"
        textbox.style.left = "" + showEachFlashcardForHowManyMeasuresTextInputHorizontalPosition + "px"
        textbox.cols = "3"
        textbox.rows = "1"
        domElements.divs.subdivisionTextInputs.appendChild(textbox);
        textbox.addEventListener('blur', (event) => {
            let newTextInputValue = textbox.value.trim() // remove whitespace from beginning and end of input then store it
            if (newTextInputValue === "" || isNaN(newTextInputValue)) { // check if new input is a real number. if not, switch input box back to whatever value it had before.
                newTextInputValue = numberOfMeasuresToShowEachFlashcardFor
            }
            newTextInputValue = parseInt(newTextInputValue)
            newTextInputValue = confineNumberToBounds(newTextInputValue, 1, 999)
            textbox.value = newTextInputValue
            if (newTextInputValue === numberOfMeasuresToShowEachFlashcardFor) {
                return
            }
            numberOfMeasuresToShowEachFlashcardFor = newTextInputValue
            resetFlashcardMetronome()
        });
        textbox.value = numberOfMeasuresToShowEachFlashcardFor
        return textbox;
    }

    // restart the sequence, as in move the time tracker lines back to the beginning of the sequence, etc.
    function restartSequencer() {
        let wasPaused = paused
        if (!paused) {
            pause()
        }
        mostRecentPauseTimeWithinLoop = 0
        beatOfLastUpdate = -1
        totalRuntimeOfSequencerSoFar = 0
        totalRuntimeBeforeMostRecentPause = 0 
        totalRuntimeAfterMostRecentPause = 0

        for (let i = 0; i < nextNoteToScheduleForEachRow.length; i++) {
            nextNoteToScheduleForEachRow[i] = null // reset next note to schedule. 'head' will get picked up on the next call to draw() 
        }

        for (sequencerRow of sequencer.rows) {
            let note = sequencerRow.notesList.head
            while (note !== null) {
                // reset 'last scheduled on iteration' for every note, so that notes will play even if we aren't technically on a new measure of the sequencer after restarting
                note.data.lastScheduledOnIteration = NOTE_HAS_NEVER_BEEN_PLAYED;
                note = note.next
            }
        }

        // if (!wasPaused) {
        //     unpause()
        // }
    }

    function resetFlashcards() {
        currentRemainingFlashcards = copyArray(allFlashcards);
    }

    function resetFlashcardMetronome() {
        let wasPaused = paused
        if (!paused){
            pause()
        }
        restartSequencer()
        resetFlashcards()
        indexOfNextFlashcardToShow = -1;
        currentFlashcardText.value = "";
        nextFlashcardPreviewText.value = "";
        cardsRemainingText.value = "Cards used: 0 / " + allFlashcards.length
        // if (!wasPaused) {
        //     unpause()
        // }
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
            newTextInputValue = parseFloat(newTextInputValue) // should we allow floats rather than ints?? i think we could. it probably barely makes a difference though
            // validation of the input given and updating of the textbox value will happen in the setTempo method
            setMetronomeTempo(newTextInputValue)
        })
    }

    function setMetronomeTempo(newTempo) {
        // don't allow setting loop length shorter than the look-ahead length or longer than the width of the text input
        newTempo = Math.floor(newTempo)
        newTempo = confineNumberToBounds(newTempo, minimumAllowedBeatsPerMinute, maximumAllowedBeatsPerMinute)
        domElements.textInputs.loopLengthMillis.value = newTempo
        updateSequencerLoopLength(convertBeatsPerMinuteToLoopLengthInMillis(newTempo, sequencer.rows[0].getNumberOfSubdivisions()))
        beatsPerMinute = newTempo
    }

    // intialize the text that will start out in the flashcard text input box
    function initializeFlashcardTextInputValue() {
        domElements.textInputs.flashcardTextInput.value = ["// flashcard prefixes: (all lines starting \n// with two slashes // will be ignored)", "Ab", "A", "A#", "Bb", "B", "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "~ flashcard suffixes: \n// (these begin after the first line that \n// starts with a tilde ~ and you can specify \n// no suffixes by deleting this section)", " major 7", " minor 7", " 7", " minor major 7", " diminished 7", " augmented 7", " half-diminished 7", " 7 altered"].join("\n")
    }

    function initializeFlashcardTextInputStyles() {
        domElements.textInputs.flashcardTextInput.style.top = "" + (sequencerVerticalOffset + 425) + "px"
        domElements.textInputs.flashcardTextInput.style.left = "" + (sequencerHorizontalOffset) + "px"
    }

    function initializeFlashcardTextInputActionListeners() {
        domElements.textInputs.flashcardTextInput.addEventListener('blur', (event) => {
            oldFlashcards = copyArray(allFlashcards)
            allFlashcards = parseFlashcardsFromString(domElements.textInputs.flashcardTextInput.value)
            if (arrayEquals(oldFlashcards, allFlashcards)) {
                return;
            }
            resetFlashcardMetronome()
        })
    }

    function filterTextInputToInteger(newValue, oldValue, lowerBound, upperBound) {
        if (newValue === "" || isNaN(newValue)) {
            return oldValue;
        }
        let newValueInt = parseInt(newValue)
        return confineNumberToBounds(newValueInt, lowerBound, upperBound)
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
        /**
         * This is a temporary quick fix for an issue where changing the tempo of the metronome breaks the logic for iterating 
         * through flashcards. Search for other occurrences of this method for a more detailed description of the issue. 
         * Or see https://github.com/adamcogen/flashcard-metronome/issues/43
         */
        resetFlashcardMetronome()
    }

    function initializeSubdivisionTextInputsValuesAndStyles() {
        for (let rowIndex = 0; rowIndex < sequencer.rows.length; rowIndex++) {
            let textArea = document.createElement("textarea");
            textArea.cols = "3"
            textArea.rows = "1"
            textArea.style.position = "absolute"
            if (rowIndex === 0) {
                textArea.style.top = "" + numberOfBeatsTextInputYPosition + "px"
                textArea.style.left = "" + numberOfBeatsTextInputXPosition + "px"
            } else if (rowIndex === 1) {
                textArea.style.top = "" + numberOfSubdivisionsPerBeatTextInputYPosition + "px"
                textArea.style.left = "" + numberOfSubdivisionsPerBeatTextInputXPosition + "px"
            } else { // not planning to need any rows besides the first and second one for the metronome, but keeping this here for convenience just in case they have a use eventually
                textArea.style.top = "" + (sequencerVerticalOffset + (rowIndex * spaceBetweenSequencerRows) + subdivisionTextInputVerticalPadding) + "px"
                textArea.style.left = "" + (sequencerHorizontalOffset + sequencerWidth + subdivisionTextInputHorizontalPadding) + "px"
            }
            textArea.style.borderColor = sequencerAndToolsLineColor
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
                if (newTextInputValue === sequencer.rows[rowIndex].getNumberOfSubdivisions()) {
                    return
                }
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
        } else {
            // new number of beats on top row is less than old number of beats on top row. 
            // we need to deal with the 'next flashcard preview', in case it's showing the preview on a beat that doesn't exist anymore
            beatNumberToShowNextFlashcardPreviewOn = confineNumberToBounds(beatNumberToShowNextFlashcardPreviewOn, 0, newNumberOfBeatsOnTopRow - 1)
            showPreviewOnWhichBeatTextInput.value = beatNumberToShowNextFlashcardPreviewOn + 1
        }
        
        // update the bottom row to have the right number of subdivisions for how many beats there are in the top row now
        sequencer.rows[1].setNumberOfSubdivisions(newNumberOfBeatsOnTopRow * newNumberOfSudvisisionsPerBeatOnBottomRow)

        // now deal with row 1 (the bottom row).
        // to keep it simple for now, let's just delete everything from the bottom and add all new stuff..
        // i haven't implemented the actual method to reset a row yet.. this should work for now
        sequencer.rows[1].notesList = new PriorityLinkedList()
        for (let i = 0; i < nextNoteToScheduleForEachRow.length; i++) {
            nextNoteToScheduleForEachRow[i] = null
        }

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

        /**
         * todo: come up with better logic for changing number of subdivisions of the top row while the sequencer is running.
         * the current problem comes from trying to calculate the number of measures that have elapsed so far. 
         * this calculation uses the number of beats in the top row, the bpm, and the amount of time elapsed so far,
         * so whenever one of these suddenly changes, the whole calculation gets thrown off. 
         * i think what needs to happen to fix this, is that whenever one of these values suddenly changes,
         * - all already-fully-finished measures get added to the 'elapsed time before last pause' piece of the calculation
         * - any partially-completed last measure gets scaled up or down somehow? so that a calculated time of the current 
         * measure stil reflects what we expect it to with the new number of subdivisions? and this measure is left in the
         * 'time after last unpause' piece of the calculation
         * - i'm not sure, i need to think about this more
         * See https://github.com/adamcogen/flashcard-metronome/issues/43
         */
        resetFlashcardMetronome()
    }

    function parseFlashcardsFromString(inputString, commentDelimeter="//", suffixesDelimeter="~") {
        // convert the input string into an array with each line as its own array element, and remove an empty lines
        lines = inputString.split("\n").filter(line => line !== '' );
        // also remove all 'comment' lines (lines that start with the 'comment' delimeter), since the parser will ignore them
        lines = lines.filter(line => !line.startsWith(commentDelimeter))
        // start parsing the actual text of each line
        let prefixes = []
        let inSuffixesSection = false
        let suffixes = []
        for (line of lines) {
            if (inSuffixesSection === false && line.startsWith(suffixesDelimeter)) {
                /**
                 * for the _first_ line that starts with the 'suffixes' delimeter,
                 * note down that we're now in the 'suffixes' section of the inputs,
                 * and skip the rest of that line (so any other text on the same line 
                 * as the first appearance of the 'suffixes section' delimeter will 
                 * be ignored, similar to a commment line).
                 * subsequent appearances of the suffixes section delimeter will be
                 * ignored, since we're already in the suffixes section. that will
                 * be treated as normal flashcard contents.
                 */
                inSuffixesSection = true;
                continue;
            }
            if (inSuffixesSection) {
                suffixes.push(line)
            } else {
                prefixes.push(line)
            }
        }
        // create and return the list of flashcards
        let flashcards = []
        if (prefixes.length > 0 && suffixes.length > 0){
            /**
             * if prefixes and suffixes are both present, generate 
             * all possible combinations of prefix + suffix
             */
            for (prefix of prefixes) {
                for (suffix of suffixes) {
                    flashcards.push("" + prefix + suffix);
                }
            }
        } else {
            /**
             * if either prefixes or suffixes are not present,
             * just return all prefixes and suffixes -- one of these 
             * lists is known to be empty, so this will just end up 
             * being either all prefixes, or all suffixes.
             * If the first non-comment line of the file is the suffix
             * delimeter, we will end up with all suffixes and just 
             * return those.
             * 
             * If there is no suffix delimeter at all or the last 
             * non-comment line of the file is the suffix delimeter,
             * we will end up with only prefixes and just return those.
             * 
             * Only suffixes is a weird case, but I'd rather just support
             * it than deal with throwing errors for bad inputs.
             */
            flashcards.push(...prefixes)
            flashcards.push(...suffixes)
        }
        return flashcards
    }

    // some basic happy-path unit testing for the flashcard parser
    function testParseFlashcardsFromString(){
        /**
         * most basic tests: empty list, 1 item, multiple items. no comments or suffix delimeters
         */
        assertArraysEqual([], parseFlashcardsFromString(""), "most basic empty flashcard list")
        assertArraysEqual(["card 1"], parseFlashcardsFromString("card 1"), "most basic single-item flashcard list")
        assertArraysEqual(["card 1", "card 2", "card 3"], parseFlashcardsFromString("card 1\ncard 2\ncard 3"), "most basic multiplie-item flashcard list")
        /**
         * test trailing and extra whitespace 
         */
        assertArraysEqual([], parseFlashcardsFromString("\n"), "empty flashcard list with one newline")
        assertArraysEqual([], parseFlashcardsFromString("\n\n\n\n\n\n\n\n"), "empty flashcard list with multiple newlines")
        assertArraysEqual(["card 1"], parseFlashcardsFromString("\n\n\n\n\ncard 1\n\n\n\n\n\n"), "single-item flashcard list with extra newlines at beginning and end")
        assertArraysEqual(["card 1", "card 2", "card 3"], parseFlashcardsFromString("\n\n\n\ncard 1\n\ncard 2\ncard 3\n\n\n\n"), "multiplie-item flashcard list with mutliple newlines at beginning, end, and throughout")
        /**
         * test including comments
         */
        assertArraysEqual([], parseFlashcardsFromString("//comment line"), "empty flashcard list with one comment line")
        assertArraysEqual([], parseFlashcardsFromString("//comment line\n//another comment line\n//third comment line"), "empty flashcard list with multiple comment lines")
        assertArraysEqual(["card 1"], parseFlashcardsFromString("//comment line\ncard 1"), "single-item flashcard list starting with one comment line")
        assertArraysEqual(["card 1"], parseFlashcardsFromString("card 1\n//comment line"), "single-item flashcard list ending with one comment line")
        assertArraysEqual(["card 1", "card 2", "card 3"], parseFlashcardsFromString("//comment line\n//second comment line\ncard 1\ncard 2\ncard 3\n//third comment line\n//fourth comment line"), "multiplie-item flashcard list starting and ending with multiple comment lines")
        assertArraysEqual(["card 1", "card 2", "card 3"], parseFlashcardsFromString("//comment line\n//second comment line\ncard 1\n//thid comment line\n//fourth comment line\ncard 2\n//fifth comment line\ncard 3\n//sixth comment line\n//seventh comment line"), "multiplie-item flashcard list starting and ending with multiple comment lines, and with multiple comment lines throught")
        /**
         * combine extra and trailing newlines with comment lines
         */
        assertArraysEqual([], parseFlashcardsFromString("\n\n\n\n\n//comment line\n\n\n//another comment line\n//third comment line\n\n\n\n"), "empty flashcard list with multiple comment lines and multiple extra newlines at beginning, end, and throughout")
        assertArraysEqual(["card 1", "card 2", "card 3"], parseFlashcardsFromString("\n\n\n\n//comment line\n\n\n//second comment line\ncard 1\n\n\n\n\n\n//thid comment line\n//fourth comment line\ncard 2\n//fifth comment line\n\n\n\ncard 3\n\n\n\n\n\n//sixth comment line\n//seventh comment line\n\n\n\n\n\n\n\n"), "multiplie-item flashcard list starting and ending with multiple comment lines, and with multiple comment lines throught, and with extra newlines at beginning, end, and throughout")
        /**
         * test basic prefix + suffix parsing
         */
        assertArraysEqual(["card 1"], parseFlashcardsFromString("card \n~\n1"), "most basic single-item prefix + suffix parsing flashcard list")
        assertArraysEqual(["card 1", "card 2", "card 3"], parseFlashcardsFromString("card \n~\n1\n2\n3"), "basic multiple-item prefix + suffix parsing flashcard list. one prefix with multiple suffixes.")
        assertArraysEqual(["card 1", "card 2", "card 3"], parseFlashcardsFromString("card 1\ncard 2\ncard 3\n~ this text should be ignored"), "basic multiple-item prefix + suffix parsing flashcard list. multiple prefixes with an empty suffixes list, and also extra text on the suffix delimeter line.")
        assertArraysEqual(["card 1", "flashcard 1", "item 1"], parseFlashcardsFromString("card \nflashcard \nitem \n~\n1"), "basic multiple-item prefix + suffix parsing flashcard list. multiple prefixes with one suffix.")
        assertArraysEqual(["card 1", "card 2", "card 3", "flashcard 1", "flashcard 2", "flashcard 3", "item 1", "item 2", "item 3"], parseFlashcardsFromString("card \nflashcard \nitem \n~\n1\n2\n3"), "basic multiple-item prefix + suffix parsing flashcard list. multiple prefixes with multiple suffixes.")
        assertArraysEqual(["card 1"], parseFlashcardsFromString("card \n~ this text should be ignored\n1"), "basic single-item prefix + suffix parsing flashcard list. add extra text to suffix delimeter line.")
        assertArraysEqual(["card 1", "card 2", "card 3", "flashcard 1", "flashcard 2", "flashcard 3", "item 1", "item 2", "item 3"], parseFlashcardsFromString("card \nflashcard \nitem \n~ this text should be ignored\n1\n2\n3"), "basic multiple-item prefix + suffix parsing flashcard list. multiple prefixes with multiple suffixes. add extra text to suffix delimeter line.")
        /**
         * test prefix + suffix parsing with comments and extra newlines
         */
        assertArraysEqual(["card 1", "card 2", "card 3", "flashcard 1", "flashcard 2", "flashcard 3", "item 1", "item 2", "item 3"], parseFlashcardsFromString("\n\n\n\n\n\ncard \n\nflashcard \n\n\n\nitem \n\n\n~\n\n\n\n1\n\n\n\n2\n3\n\n\n\n\n"), "multiple-item prefix + suffix parsing flashcard list. multiple prefixes with multiple suffixes. also include extra newlines at beginning, end, and throughout.")
        assertArraysEqual(["card 1", "card 2", "card 3", "flashcard 1", "flashcard 2", "flashcard 3", "item 1", "item 2", "item 3"], parseFlashcardsFromString("//comment 1\n//comment 2\ncard \nflashcard \n//comment 3\nitem \n//comment 4\n//comment 5\n~\n//comment 6\n//comment 7   \n1\n//comment 8\n2\n3\n//comment 9\n//comment 10"), "multiple-item prefix + suffix parsing flashcard list. multiple prefixes with multiple suffixes. also include comments at beginning, end, and throughout.")
        assertArraysEqual(["card 1", "card 2", "card 3", "flashcard 1", "flashcard 2", "flashcard 3", "item 1", "item 2", "item 3"], parseFlashcardsFromString("\n\n\n\n\n//comment 1\n\n\n//comment 2\n\ncard \n\nflashcard \n//comment 3\nitem \n\n\n\n//comment 4\n//comment 5\n\n~\n\n\n//comment 6\n//comment 7   \n\n\n1\n//comment 8\n2\n3\n//comment 9\n\n\n\n\n\n//comment 10\n\n\n\n\n"), "multiple-item prefix + suffix parsing flashcard list. multiple prefixes with multiple suffixes. also include extra newlines and comments at beginning, end, and throughout.")
        assertArraysEqual(["card 1", "card 2", "card 3", "flashcard 1", "flashcard 2", "flashcard 3", "item 1", "item 2", "item 3"], parseFlashcardsFromString("\n\n\n\n\n//comment 1\n\n\n//comment 2\n\ncard \n\nflashcard \n//comment 3\nitem \n\n\n\n//comment 4\n//comment 5\n\n~this text should be ignored\n\n\n//comment 6\n//comment 7   \n\n\n1\n//comment 8\n2\n3\n//comment 9\n\n\n\n\n\n//comment 10\n\n\n\n\n"), "multiple-item prefix + suffix parsing flashcard list. multiple prefixes with multiple suffixes. also include extra newlines and comments at beginning, end, and throughout. add extra text to suffix delimeter line.")
        /**
         * test some suffix-only lists
         */
        assertArraysEqual([], parseFlashcardsFromString("~"), "empty suffix-only flashcard list")
        assertArraysEqual([], parseFlashcardsFromString("~ this text should be ignored"), "empty suffix-only flashcard list with extra text on suffix delimeter line")
        assertArraysEqual([], parseFlashcardsFromString("\n\n//comment 1\n~\n\n//comment 2\n\n\n"), "empty suffix-only flashcard list with comments and extra newlines")
        assertArraysEqual(["card 1"], parseFlashcardsFromString("~\ncard 1"), "most basic single-item suffix-only flashcard list")
        assertArraysEqual(["card 1"], parseFlashcardsFromString("\n\n\n\n//comment 1\n//comment 2\n\n~\n//comment 3\n\ncard 1\n\n\n"), "basic single-item suffix-only flashcard list with comments and extra newlines")
        assertArraysEqual(["card 1", "card 2", "card 3"], parseFlashcardsFromString("~\ncard 1\ncard 2\ncard 3"), "most basic multiple-item suffix-only flashcard list")
        assertArraysEqual(["card 1", "card 2", "card 3"], parseFlashcardsFromString("\n\n\n\n//comment 1\n~\n//comment 2\n//comment 3\ncard 1\n//comment 4\n//comment 5\ncard 2\ncard 3\n//comment 6\n\n\n\n"), "basic multiple-item suffix-only flashcard list with comments and extra newlines")
        /**
         * test prefixes + suffixes, with comments, extra newlines, _and multiple suffix delimeter lines_
         */
         assertArraysEqual(["card ~ 1", "card 2", "card  ~ 3", "flashcard ~ 1", "flashcard 2", "flashcard  ~ 3", "item ~ 1", "item 2", "item  ~ 3"], parseFlashcardsFromString("\n\n\n\n\n//comment 1\n\n\n//comment 2\n\ncard \n\nflashcard \n//comment 3\nitem \n\n\n\n//comment 4\n//comment 5\n\n~this text should be ignored\n\n\n//comment 6\n//comment 7   \n\n\n~ 1\n//comment 8\n2\n ~ 3\n//comment 9\n\n\n\n\n\n//comment 10\n\n\n\n\n"), "multiple-item prefix + suffix parsing flashcard list. multiple prefixes with multiple suffixes. include extra newlines and comments throughout. add extra text to suffix delimeter line. include multple suffix delimeter lines")
    }

    function assertArraysEqual(expectedArray, actualArray, message) {
        if (expectedArray.length !== actualArray.length) {
            throw "array equality assertion failed: '" + message + "'. array lengths were not the same. expected array: '" + expectedArray + "'; actual array: '" + actualArray + "'. expected array length: " + expectedArray.length + "; actual array length: " + actualArray.length + ""
        }
        for (let i = 0; i < actualArray.length; i++) {
            if (actualArray[i] !== expectedArray[i]) {
                throw "array equality assertion failed: '" + message + "'. expected array: '" + expectedArray + "'; actual array: '" + actualArray + "'"
            }
        }
    }

    function arrayEquals(array0, array1) {
        if (array0.length !== array1.length) {
            return false;
        }
        for (let i = 0; i < array0.length; i++) {
            if (array0[i] !== array1[i]) {
                return false;
            }
        }
        return true;
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

    function copyArray(arrayToCopy) {
        return [...arrayToCopy]
    }

    // todo: check -- does this return an empty list if there is no element with the given index?
    function deleteArrayElementAtIndex(array, indexOfElementToDelete) {
        let listOfOneRemovedElement = array.splice(indexOfElementToDelete, 1) // this should go in and delete the element we want to delete!
        return listOfOneRemovedElement
    }

    // return a random integer between 0 and 'maximum'
    function getRandomInteger(maximum) {
        return Math.floor(Math.random() * maximum);
    }
}
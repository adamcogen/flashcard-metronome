### About

This project is a music practice tool that allows you to synchronize a "flashcard deck" to a metronome. 

The code is a quick-and-dirty adaptation of the JavaScript drum machine I am working on here https://github.com/adamcogen/drum-machine with some GUI changes. 

The 'drum machine' repo uses the same data structure / scheduling algorithm for the backend, and will be cleaner and better-maintained than this flashcard metronome repo.

Metronome specifications:
 - uses precise audio timing, by scheduling notes ahead-of-time with the WebAudio API
 - runs on client-side-only JavaScript
 - has primarily been tested in Chrome browser

### Usage

The "flashcards" are individual lines of text, which will be shown in a random order as the metronome progresses. 

You can specify your own list of flashcards and configure how they are shown in the settings menu of the metronome. 

You can click the notes of the metronome to change their sound or mute them. You can change the nunmber of beats per measure or add subdivisions in the settings menu.

#### Flashcard format

Flashcards are entered as lines of text, one line per card.

If any line in the flashcard input starts with two slashes ("//"), it will be ignored by the flashcard text parser.

Here's an example list of flashcards:

```
// this line will be ignored since it starts with // two slashes, so you can include annotations in the flashcard deck
flashcard 1
flashcard 2
flashcard 3
```

You can also generate flashcards from a set of "prefixes" and "suffixes". The "suffixes" section of the input will start after the first line that begins with a tilde character ("~").

Here's an example set of flashcards generated from a list of prefixes and suffixes:

```
prefix 1 ;
prefix 2 ;
~ suffixes start after this line, since it starts with a ~ tilde
 suffix 1
 suffix 2
```

The resulting list of cards will be:

```
prefix 1 ; suffix 1
prefix 1 ; suffix 2
prefix 2 ; suffix 1
prefix 2 ; suffix 2
```

### Run locally:

Local HTTP server is needed to avoid Cross Origin Request issues when loading sound files (at least in Chrome browser).

For Mac, run one of the .sh files included in this repo to start the HTTP server:

Python 2:
```
sh server.python2.sh
```

Python 3:
```
sh server.python3.sh
```

then in a browser go to:

```
http://localhost:8000/
```

and replace 8000 with whatever port number the server says it's running on.

For Windows, you should be able to just run the commands that are in these .sh files from the command line to start the HTTP server.

### Java implementation

I previously implemented this in Java in 2018 because that was the only language I knew at the time. I wanted re-implement this in JavaScript just for fun, since it is much easier to install and use, and I'm already working on a Javascript drum machine that works as the metronome backend anyway.

Here is a screen capture of the old Java implementation from 2018, which is not on GitHub. The Java version wasn't as interactive, didn't have as many features, and needed to be run from a JAR file..

![Java Flashcard Metronome](images/java-5.gif "Java Flashcard Metronome")
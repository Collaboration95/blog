// The editor's markup. A post without a section here gets the rule in build.mjs.
// All quoted text is verbatim from the post. The build stops if it can't find it.
//
//   ![03](Sunday's ^ hackathon)        frame 03 goes where the ^ is, mid-sentence
//   ![03 in](...)                      on a wide screen it stays in the text strip and splits the sentence,
//                                      instead of hanging beside it on the side strip
//   (o)[96%]                           yellow ring on those words. (o red) red. (x) struck. (_) underlined
//   (x 23)[26 minutes]                 the same, only in block 23
//   @04 ring 69 26 9 5 -> 2 hours 47 minutes
//                                      red ring on frame 04 at x y rx ry (percent of the image),
//                                      with a pencil line to the marked words
//   @04 cross 90 29 3 5                cross. @02 box  a print mark round the whole frame
//   ~ 3 minutes -> 44 seconds          pencil line from one marked phrase to another
//   lede 1-3                           these blocks are set large
//   side 3                             on a wide screen this lede hangs as a frame at the top of the side strip
//   frame 7 exp 1                      block 7 becomes a text frame at that exposure, 0 to 1
//   frame 9 cross / frame 18 pick      crossed out / circled. frame 13 in: stays in the text strip on a wide screen
//   strip 9-12                         blocks become frames on one strip

# commons-agent-logs
![03](from Sunday's ^ hackathon.)
![04](once the organisers explained more. ^ Picking the new idea)
![01](in the middle of the demo window. ^)
![02 in](that redrew ^ the venue photo.)
![05](so the room could redraw itself on stage. ^)
(o red)[Sunday's]
(o red)[All ten]
(o red)[2 hours 47 minutes]
(o red)[17:11]
(o red)[demo window]
(o red)[$2.79]
(_)[the venue photo]
(o)[96%]
(o)[$182]
(o)[3 minutes]
(o)[44 seconds]
@03 ring 39 29 13 21 -> Sunday's
@04 cross 13.5 26 7 6 -> All ten
@04 ring 69 26 9 5.5 -> 2 hours 47 minutes
@04 cross 90.6 28.8 3 5.4 -> 17:11
@01 ring 33.5 77.6 10 3.6 -> demo window
@02 box
@05 ring 42 37.5 6.6 4.6 -> $2.79
~ 3 minutes -> 44 seconds

# apple-health-import
lede 1-3
side 3
(o red)[163x]
frame 7 exp 1
frame 9 cross
frame 10 cross
frame 11 cross
frame 12 cross
strip 9-12
frame 13 exp .81 in
frame 16 cross
frame 17 cross
frame 18 pick
strip 16-18
frame 23 exp .006
(o red 23)[9.77 seconds]
(x 23)[26 minutes]
~ 26 minutes -> 21 minutes
~ 21 minutes -> 9.77 seconds
(_ 7)[26 minutes]
(_ 13)[21 minutes]

# commons-best-use-of-tech
![01](the night before, and by morning agents had prototyped ten ideas for me. ^)
![02](walks into a cartoon of the room you're sitting in, ^ with your name on it.)
![03](I entered as a solo dev , ^ but it doesnt mean i could have done it alone.)
@03 ring 50.3 47 8 5.5

# commons-peoples-choice
![01](Codex writes it, tests it and draws it, ^ and about a minute later)
@01 ring 74.5 66.4 6 5
(o)[$8]
(o)[2 to 6 cents]

# commons-claude-switch
![01](Yesterday,  I went to Claude Code SG at Grab. ^ A day later)
![02 03](So I wrote the test before picking a model. ^ 43 labelled wishes)
![04](Four pets at once went live in 13 to 16 seconds. ^ If the API fails)
@04 ring 39.5 41.8 8 5
(o)[4.9 seconds]
(o)[$2.62]

# project the-commons
preview commons-best-use-of-tech 1
pick commons-best-use-of-tech About a minute later it walks into a cartoon of the room you're sitting in, with your name on it. | About a minute later
pick commons-agent-logs A pet now takes 44 seconds with six wishes in flight, about 4x faster. | 44 seconds
pick commons-claude-switch Four pets at once went live in 13 to 16 seconds. | 13 to 16 seconds
~ About a minute later -> 44 seconds
~ 44 seconds -> 13 to 16 seconds

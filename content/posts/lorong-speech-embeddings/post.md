"Eh, you makan already a not ah?"

Spent Wednesday afternoon at Lorong AI's AI Wednesdays learning how people are getting speech and embedding models actually to understand sentences like that, and the languages around Southeast Asia.

En Lih Lye explained  how HTX adapted an existing spoken language model into HT-Moonstone, a 5B model that handles Singapore's four official languages and how the disparity in training data for Tamil and Malay was handled.

Vincent Nguyen, PhD shared his team's experience of adapting SEALion, and how sometimes adopting counterintuitive methods resulted in better outcomes, like instead of starting from the latest SEA-LION checkpoint from AISingapore, they went back to an earlier one. 

Surprisingly, it performed better. From there, they tuned it to their own use case with upsampled data, harder negatives and a second look at which metrics actually mattered.

Their  model now beats both EmbeddingGemma and SEA-LION-Embedding on all five of their internal tasks.

The newest checkpoint isn't automatically the best starting point especially when your language is a small slice of what the model saw.

Raymond and Peerat Limkonchotiwat from AI Singapore also walked through the SEA-LION embedding work, including sequence packing to stop wasting compute on padding.


Thanks En Lih Lye for letting me pick your brain afterwards and answering all my questions.

And thanks to Lorong AI and As'safiy As'adi for hosting another great session.

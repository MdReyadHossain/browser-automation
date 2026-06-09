const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class OpenAiService {
    constructor() { }

    fillUpJobForm = async (fields, userInfo) => {
        try {
            const prompt = `
            You are an expert at filling out job application forms.
            You will be given a list of form fields and a candidate's information.
            Your job is to map the correct value to each field.

            FORM FIELDS:
            ${JSON.stringify(fields.map(f => ({
                index: f.index,
                label: f.label,
                placeholder: f.placeholder,
                type: f.type,
                name: f.name,
                required: f.required,
                options: f.options
            })), null, 2)}

            CANDIDATE INFORMATION:
            ${JSON.stringify(userInfo, null, 2)}

            INSTRUCTIONS:
            - Every field must have an action
            - For fields where user data is not available, use "skip"
            - For required fields where data is missing, make a reasonable guess
            - For dropdowns, value must exactly match one of the provided options
            - For checkboxes like "I agree to terms", action is "check"
            - For file upload fields, action is "upload"
            - Do not include any explanation, only return the JSON array

            RETURN FORMAT (strict JSON array, nothing else): For example:
            [
                {
                    "index": 0,
                    "label": "First Name",
                    "action": "fill",
                    "value": "<user name>",
                    "reason": "matched firstName from user info"
                },
                {
                    "index": 1,
                    "label": "Country",
                    "action": "select",
                    "value": "<country from dropdown options>",
                    "reason": "matched country from user info"
                },
                {
                    "index": 2,
                    "label": "Resume",
                    "action": "upload",
                    "value": "<user resume file url or path>",
                    "reason": "file upload field"
                },
                {
                    "index": 3,
                    "label": "I agree to terms",
                    "action": "check",
                    "value": true,
                    "reason": "terms agreement checkbox"
                },
                {
                    "index": 4,
                    "label": "LinkedIn (optional)",
                    "action": "skip",
                    "value": "<user linkedin url if available, otherwise null>",
                    "reason": "no linkedin in user info"
                },
                ...for other questions fields, provide similar objects with valid actions and values based on the user info and field requirements
            ]
        `;

            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1,
                response_format: { type: "json_object" }
            });

            const raw = response.choices[0].message.content.trim();

            const parsed = JSON.parse(raw);

            const actions = Array.isArray(parsed) ? parsed : parsed.actions || parsed.fields || [];

            console.log('\n========== AI FORM FILL PLAN ==========');
            actions.forEach(a => {
                console.log(`[${a.action.toUpperCase()}] ${a.label} → "${a.value}" (${a.reason})`);
            });

            return actions;

        } catch (error) {
            console.error("Error in fillUpJobForm:", error);
            throw new Error("Failed to generate form fill plan");
        }
    };

    getFormFieldsWithAI = async (formHTML) => {
        try {
            const prompt = `
                You are an expert at analyzing HTML forms for job applications.
                Analyze the following HTML and extract ALL form fields.

                For radio buttons, find the parent container's question text — it's usually a heading or paragraph ABOVE the radio group.
                For checkboxes, find the associated question or label similarly.
                For grouped fields (same "name" attribute), treat them as ONE field with multiple options.

                HTML:
                ${formHTML.substring(0, 15000)}

                Return ONLY a valid JSON array, no explanation, no markdown:
                for example: [
                    {
                        "index": 0,
                        "type": "text",
                        "label": "First Name",
                        "placeholder": "",
                        "name": "first_name",
                        "required": true,
                        "groupQuestion": ""
                    },
                    {
                        "index": 1,
                        "type": "radio",
                        "label": "Yes, No",
                        "placeholder": "",
                        "name": "work_authorization",
                        "required": true,
                        "groupQuestion": "Are you legally authorized to work in France?",
                        "radioOptions": ["Yes", "No"]
                    },
                    {
                        "index": 2,
                        "type": "select",
                        "label": "Country",
                        "placeholder": "",
                        "name": "country",
                        "required": false,
                        "groupQuestion": "",
                        "selectOptions": ["United States", "Bangladesh", "France"]
                    },
                    {
                        "index": 3,
                        "type": "file",
                        "label": "Resume",
                        "placeholder": "",
                        "name": "resume",
                        "required": true,
                        "groupQuestion": ""
                    },
                    {
                        "index": 4,
                        "type": "checkbox",
                        "label": "I agree to terms",
                        "placeholder": "",
                        "name": "terms",
                        "required": true,
                        "groupQuestion": ""
                    }
                ]

                IMPORTANT:
                - Radio groups with same "name" → merge into ONE object with radioOptions array
                - Select dropdowns → include selectOptions array with all option texts
                - index must be sequential starting from 0
                - groupQuestion is the question/heading above the radio or checkbox group
            `;

            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1,
            });

            const raw = response?.choices[0]?.message?.content?.trim();
            const cleaned = raw
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/```$/i, '')
                .trim();

            console.log("Raw AI response for form fields:", raw);
            return JSON.parse(cleaned);
        } catch (error) {
            console.error("Error extracting form fields with AI:", error);
            throw new Error("Failed to extract form fields");
        }
    }

    getFormFieldsAnswers = async (fields, userInfo) => {
        try {
            const prompt = `
                You are an expert job application assistant. Based on the candidate's profile and the form fields provided, determine the best answer for each field.

                CANDIDATE PROFILE:
                ${JSON.stringify(userInfo, null, 2)}

                FORM FIELDS:
                ${JSON.stringify(fields, null, 2)}

                INSTRUCTIONS:
                - For text/email/phone fields: provide the exact value from candidate profile
                - For radio fields: choose the best option from radioOptions based on candidate's profile and experience
                - For combobox/select fields: choose the most appropriate option from the available options list
                - For file fields: action is always "upload"
                - For checkbox fields: check if it's terms/agreement → always "check"
                - If candidate info is insufficient for a required field: make a reasonable guess
                - If field is optional and no data available: action is "skip"
                - For salary fields: pick the most appropriate range based on candidate's experience level
                - For Yes/No questions about experience: carefully read the question and answer based on CV content

                IMPORTANT — Response must be a raw JSON array only, no markdown, no explanation:
                [
                    {
                        "index": 0,
                        "type": "text",
                        "label": "First Name",
                        "action": "fill",
                        "value": "John",
                        "reason": "from firstName field"
                    },
                    {
                        "index": 1,
                        "type": "radio",
                        "label": "Do you have a native level in French?",
                        "action": "radio",
                        "value": "No",
                        "reason": "candidate is from Bangladesh, no French mentioned in profile"
                    },
                    {
                        "index": 2,
                        "type": "combobox",
                        "label": "What are your salary expectations?",
                        "action": "combobox",
                        "value": "50-55k",
                        "reason": "junior level with 1 year experience, mid-low range appropriate"
                    },
                    {
                        "index": 3,
                        "type": "file",
                        "label": "Resume",
                        "action": "upload",
                        "value": "resume",
                        "reason": "file upload field"
                    },
                    {
                        "index": 4,
                        "type": "checkbox",
                        "label": "I agree to terms",
                        "action": "check",
                        "value": true,
                        "reason": "terms agreement checkbox"
                    },
                    {
                        "index": 5,
                        "type": "text",
                        "label": "LinkedIn",
                        "action": "skip",
                        "value": null,
                        "reason": "optional field, no data available"
                    }
                ]

                action types:
                - "fill"     → text, email, tel, textarea
                - "radio"    → radio button (value must exactly match one of radioOptions)
                - "combobox" → custom dropdown (value must exactly match one of options)
                - "select"   → native select (value must exactly match one of options)
                - "upload"   → file input
                - "check"    → checkbox
                - "skip"     → optional, no data
            `;

            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1,
            });

            const raw = response?.choices[0]?.message?.content?.trim();
            const cleaned = raw
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/```$/i, '')
                .trim();

            const answers = JSON.parse(cleaned);

            // Console এ readable format এ দেখাও
            console.log('\n========== FORM FILL PLAN ==========');
            answers.forEach(a => {
                if (a.action === 'skip') {
                    console.log(`[SKIP]     "${a.label}"`);
                } else {
                    console.log(`[${a.action.toUpperCase().padEnd(8)}] "${a.label}" → "${a.value}" | ${a.reason}`);
                }
            });
            console.log(`\n✅ Total answers: ${answers.length}`);

            return answers;

        } catch (error) {
            console.error("Error getting form field answers:", error);
            throw new Error("Failed to get form field answers");
        }
    }
}

module.exports = new OpenAiService();
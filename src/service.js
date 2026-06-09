const { OpenAI } = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const fillUpJobForm = async (fields, userInfo) => {
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
            options: f.options,  // dropdown এর জন্য
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

const getFormFieldsWithAI = async (formHTML) => {
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

module.exports = {
    fillUpJobForm,
    getFormFieldsWithAI,
};